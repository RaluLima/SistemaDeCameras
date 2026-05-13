import cv2
import numpy as np
import time
import os
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class DetectionResult:
    fall_detected: bool
    motion_detected: bool
    confidence: float = 0.0
    persons_detected: int = 0


class PersonTrack:
    __slots__ = (
        "track_id", "bbox", "center_y", "aspect_ratio",
        "prev_center_y", "prev_aspect_ratio", "velocity_y",
        "horizontal_since", "last_alert_time", "fall_frames",
        "total_frames", "missed_frames", "matched",
    )

    def __init__(self, bbox: tuple, track_id: int):
        self.track_id = track_id
        self.bbox = bbox
        _, y, bw, bh = bbox
        self.center_y = y + bh // 2
        self.aspect_ratio = bh / float(bw) if bw > 0 else 0
        self.prev_center_y = self.center_y
        self.prev_aspect_ratio = self.aspect_ratio
        self.velocity_y = 0.0
        self.horizontal_since: Optional[float] = None
        self.last_alert_time = 0.0
        self.fall_frames = 0
        self.total_frames = 0
        self.missed_frames = 0
        self.matched = False


class FallDetector:
    def __init__(self, camera_id: str = "default"):
        self.camera_id = camera_id
        self.hog_interval = int(os.getenv("HOG_INTERVAL", "5"))
        self.frame_count = 0

        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=int(os.getenv("BG_HISTORY", "500")),
            varThreshold=int(os.getenv("BG_VAR_THRESHOLD", "50")),
        )
        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

        self.min_fall_frames = int(os.getenv("MIN_FALL_FRAMES", "3"))
        self.fall_cooldown = float(os.getenv("FALL_COOLDOWN", "5.0"))
        self.velocity_threshold = float(os.getenv("VELOCITY_THRESHOLD", "8"))
        self.horizontal_duration_threshold = float(os.getenv("HORIZONTAL_DURATION", "2.0"))
        self.min_person_height = int(os.getenv("MIN_PERSON_HEIGHT", "60"))
        self.max_missed_frames = int(os.getenv("MAX_MISSED_FRAMES", "10"))

        self.next_track_id = 0
        self.tracks: dict[int, PersonTrack] = {}

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        if frame is None or frame.size == 0:
            return DetectionResult(fall_detected=False, motion_detected=False)

        h, w = frame.shape[:2]
        now = time.time()
        self.frame_count += 1

        fg_mask = self._compute_motion_mask(frame)
        motion_pixels = cv2.countNonZero(fg_mask)
        motion_detected = motion_pixels > (w * h * 0.005)

        persons = []
        if self.frame_count % self.hog_interval == 0:
            persons, _ = self.hog.detectMultiScale(
                frame, winStride=(8, 8), padding=(16, 16), scale=1.05
            )
            persons = [
                b for b in persons
                if b[3] >= self.min_person_height
            ]

        self._update_tracks(persons, motion_detected)

        fall_detected = False
        confidence = 0.0

        for person in list(self.tracks.values()):
            if person.missed_frames > 0:
                continue

            x, y, bw, bh = person.bbox
            center_y = y + bh // 2
            aspect_ratio = bh / float(bw) if bw > 0 else 0

            person.velocity_y = center_y - person.prev_center_y
            ratio_change = aspect_ratio - person.prev_aspect_ratio

            person.prev_center_y = center_y
            person.prev_aspect_ratio = aspect_ratio
            person.total_frames += 1

            is_horizontal = aspect_ratio < 0.8
            is_falling = person.velocity_y > self.velocity_threshold
            sudden_change = ratio_change < -0.5

            if is_horizontal:
                if person.horizontal_since is None:
                    person.horizontal_since = now
                horizontal_duration = now - person.horizontal_since
            else:
                person.horizontal_since = None
                horizontal_duration = 0.0

            if (now - person.last_alert_time) > self.fall_cooldown:
                triggered = False
                if is_falling and sudden_change:
                    triggered = True
                elif is_horizontal and horizontal_duration > self.horizontal_duration_threshold:
                    triggered = True

                if triggered:
                    person.fall_frames += 1
                    if person.fall_frames >= self.min_fall_frames:
                        fall_detected = True
                        confidence = min(1.0, max(
                            abs(ratio_change),
                            abs(person.velocity_y) / 20.0,
                            0.3,
                        ))
                        person.last_alert_time = now
                        person.fall_frames = 0
                        logger.warning(
                            f"[{self.camera_id}] Fall detected - Track {person.track_id}: "
                            f"ratio_change={ratio_change:.2f}, "
                            f"velocity_y={person.velocity_y:.1f}, "
                            f"horizontal={is_horizontal}, "
                            f"h_duration={horizontal_duration:.1f}s, "
                            f"confidence={confidence:.2f}"
                        )
                else:
                    person.fall_frames = max(0, person.fall_frames - 1)

        return DetectionResult(
            fall_detected=fall_detected,
            motion_detected=motion_detected,
            confidence=confidence,
            persons_detected=len([p for p in self.tracks.values() if p.missed_frames == 0]),
        )

    def _compute_motion_mask(self, frame: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        fg_mask = self.bg_subtractor.apply(gray)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, self.kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, self.kernel)
        fg_mask = cv2.dilate(fg_mask, self.kernel, iterations=2)
        return fg_mask

    def _update_tracks(self, detected_boxes: list, motion_detected: bool):
        for track in self.tracks.values():
            track.matched = False

        if motion_detected or detected_boxes:
            for dbox in detected_boxes:
                best_track = None
                best_iou = 0.3
                for track in self.tracks.values():
                    if track.missed_frames > 0:
                        continue
                    iou = self._iou(dbox, track.bbox)
                    if iou > best_iou:
                        best_iou = iou
                        best_track = track

                if best_track:
                    best_track.bbox = dbox
                    best_track.matched = True
                    best_track.missed_frames = 0
                else:
                    self.tracks[self.next_track_id] = PersonTrack(dbox, self.next_track_id)
                    self.next_track_id += 1

        for track_id in list(self.tracks.keys()):
            if not self.tracks[track_id].matched:
                self.tracks[track_id].missed_frames += 1
                if self.tracks[track_id].missed_frames > self.max_missed_frames:
                    del self.tracks[track_id]

    def _iou(self, box_a: tuple, box_b: tuple) -> float:
        xa = max(box_a[0], box_b[0])
        ya = max(box_a[1], box_b[1])
        xb = min(box_a[0] + box_a[2], box_b[0] + box_b[2])
        yb = min(box_a[1] + box_a[3], box_b[1] + box_b[3])

        inter = max(0, xb - xa) * max(0, yb - ya)
        if inter == 0:
            return 0.0

        area_a = box_a[2] * box_a[3]
        area_b = box_b[2] * box_b[3]
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    def reset(self):
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50)
        self.tracks.clear()
        self.next_track_id = 0
        self.frame_count = 0
