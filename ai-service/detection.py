import cv2
import numpy as np
import time
from dataclasses import dataclass

@dataclass
class DetectionResult:
    fall_detected: bool
    motion_detected: bool
    confidence: float = 0.0

class FallDetector:
    def __init__(self):
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50)
        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        self.prev_aspect_ratio = None
        self.fall_cooldown = 5.0
        self.last_alert_time = 0.0
        self.prev_center_y = None
        self.velocity_y = 0.0

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        if frame is None or frame.size == 0:
            return DetectionResult(fall_detected=False, motion_detected=False)

        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        fg_mask = self.bg_subtractor.apply(gray)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, self.kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, self.kernel)
        fg_mask = cv2.dilate(fg_mask, self.kernel, iterations=2)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        motion_detected = False
        fall_detected = False
        confidence = 0.0
        now = time.time()

        min_area = int(w * h * 0.01)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue

            motion_detected = True
            x, y, bw, bh = cv2.boundingRect(cnt)

            aspect_ratio = bh / float(bw) if bw > 0 else 0
            center_y = y + bh // 2

            cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
            cv2.putText(frame, f"AR:{aspect_ratio:.1f}", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            if self.prev_aspect_ratio is not None and self.prev_center_y is not None:
                self.velocity_y = center_y - self.prev_center_y
                ratio_change = aspect_ratio - self.prev_aspect_ratio

                if (now - self.last_alert_time) > self.fall_cooldown:
                    if self.prev_aspect_ratio > 1.5 and aspect_ratio < 1.0 and abs(self.velocity_y) > 5:
                        fall_detected = True
                        confidence = min(1.0, abs(ratio_change) / 2.0)
                        self.last_alert_time = now
                        cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 0, 255), 4)
                        cv2.putText(frame, "FALL DETECTED!", (x, y - 30),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            self.prev_aspect_ratio = aspect_ratio
            self.prev_center_y = center_y

        return DetectionResult(
            fall_detected=fall_detected,
            motion_detected=motion_detected,
            confidence=confidence
        )

    def reset(self):
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50)
        self.prev_aspect_ratio = None
        self.prev_center_y = None
        self.velocity_y = 0.0
        self.last_alert_time = 0.0
