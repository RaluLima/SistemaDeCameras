import cv2
import numpy as np
import mediapipe as mp
import time
import threading
from typing import Optional, Callable

import os

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pose_landmarker.task")

class FallState:
    def __init__(self):
        self.last_alert: float = 0
        self.prev_nose_y: Optional[float] = None
        self.velocity_y: float = 0
        self.horizontal_since: Optional[float] = None
        self.alert_count: int = 0

class FallDetector:
    FALL_COOLDOWN = 5.0
    HORIZONTAL_ANGLE = 45.0
    RAPID_DESCENT = 0.04
    LONG_DOWN_TIMEOUT = 3.0

    def __init__(self, camera_id: str, rtsp_url: str, on_fall: Optional[Callable] = None):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.on_fall = on_fall
        self.state = FallState()
        self.running = False
        self.cap: Optional[cv2.VideoCapture] = None
        self.thread: Optional[threading.Thread] = None

        PoseLandmarker = mp.tasks.vision.PoseLandmarker
        PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
        RunningMode = mp.tasks.vision.RunningMode
        BaseOptions = mp.tasks.BaseOptions

        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.pose_landmarker = PoseLandmarker.create_from_options(options)

    def detect_fall(self, landmarks) -> bool:
        try:
            nose = landmarks[0]
            ls = landmarks[11]
            rs = landmarks[12]
            lh = landmarks[23]
            rh = landmarks[24]
        except (IndexError, AttributeError):
            return False

        smy = (ls.y + rs.y) / 2
        hmy = (lh.y + rh.y) / 2
        smx = (ls.x + rs.x) / 2
        hmx = (lh.x + rh.x) / 2
        dx = hmx - smx
        dy = hmy - smy
        angle = abs(np.arctan2(dx, dy) * (180 / np.pi))

        if self.state.prev_nose_y is not None:
            self.state.velocity_y = nose.y - self.state.prev_nose_y
        self.state.prev_nose_y = nose.y

        now = time.time()
        is_horizontal = angle > self.HORIZONTAL_ANGLE
        falling = self.state.velocity_y > self.RAPID_DESCENT

        if is_horizontal:
            if self.state.horizontal_since is None:
                self.state.horizontal_since = now
        else:
            self.state.horizontal_since = None

        if is_horizontal and falling and (now - self.state.last_alert > self.FALL_COOLDOWN):
            self.state.last_alert = now
            self.state.velocity_y = 0
            self.state.alert_count += 1
            print(f"[AI] QUEDA DETECTADA! camera={self.camera_id} alerta=#{self.state.alert_count}")
            return True

        if (is_horizontal and self.state.horizontal_since and
                (now - self.state.horizontal_since > self.LONG_DOWN_TIMEOUT) and
                (now - self.state.last_alert > self.FALL_COOLDOWN)):
            self.state.last_alert = now
            self.state.alert_count += 1
            print(f"[AI] QUEDA DETECTADA (prolongada)! camera={self.camera_id} alerta=#{self.state.alert_count}")
            return True

        return False

    def _process_frame(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int(time.time() * 1000)

        result = self.pose_landmarker.detect_for_video(mp_image, timestamp_ms)

        if result.pose_landmarks:
            landmarks = result.pose_landmarks[0]
            if self.detect_fall(landmarks):
                if self.on_fall:
                    self.on_fall(self.camera_id, self.state.alert_count)
                return True, landmarks
            return False, landmarks
        return False, None

    def _capture_loop(self):
        print(f"[AI] Iniciando captura RTSP: {self.camera_id} -> {self.rtsp_url}")
        self.cap = cv2.VideoCapture(self.rtsp_url)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self.cap.isOpened():
            print(f"[AI] ERRO: Nao foi possivel conectar na camera {self.camera_id}")
            self.running = False
            return

        print(f"[AI] Conectado com sucesso: {self.camera_id}")
        frame_interval = 1.0 / 15
        while self.running:
            start = time.time()
            ret, frame = self.cap.read()
            if not ret:
                print(f"[AI] Frame perdido de {self.camera_id}, reconectando...")
                self.cap.release()
                time.sleep(2)
                self.cap = cv2.VideoCapture(self.rtsp_url)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                continue

            self._process_frame(frame)
            elapsed = time.time() - start
            if elapsed < frame_interval:
                time.sleep(frame_interval - elapsed)

        if self.cap:
            self.cap.release()
        print(f"[AI] Captura finalizada: {self.camera_id}")

    def start(self):
        if self.running:
            return
        self.running = True
        self.state = FallState()
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.thread = None

    def is_running(self):
        return self.running
