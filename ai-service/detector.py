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
        self.last_ts_ms = 0

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
        # MediaPipe exige timestamps estritamente crescentes em RunningMode.VIDEO
        ts = int(time.time() * 1000)
        if ts <= self.last_ts_ms:
            ts = self.last_ts_ms + 1
        self.last_ts_ms = ts

        try:
            result = self.pose_landmarker.detect_for_video(mp_image, ts)
        except Exception as e:
            print(f"[AI] Erro MediaPipe em {self.camera_id}: {e}")
            return False, None

        if result.pose_landmarks:
            landmarks = result.pose_landmarks[0]
            if self.detect_fall(landmarks):
                if self.on_fall:
                    self.on_fall(self.camera_id, self.state.alert_count)
                return True, landmarks
            return False, landmarks
        return False, None

    def _open_capture(self) -> bool:
        self.cap = cv2.VideoCapture(self.rtsp_url)
        if self.cap is not None and self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            return True
        if self.cap is not None:
            self.cap.release()
        self.cap = None
        return False

    def _capture_loop(self):
        print(f"[AI] Iniciando captura RTSP: {self.camera_id} -> {self.rtsp_url}")
        frame_interval = 1.0 / 15
        reconnect_failures = 0

        try:
            if not self._open_capture():
                print(f"[AI] Stream indisponivel para {self.camera_id}; aguardando reconexao...")
                reconnect_failures += 1

            if reconnect_failures == 0:
                print(f"[AI] Conectado com sucesso: {self.camera_id}")

            while self.running:
                if self.cap is None:
                    # stream caiu: tenta reconectar indefinidamente
                    if self._open_capture():
                        reconnect_failures = 0
                        print(f"[AI] Reconectado: {self.camera_id}")
                    else:
                        reconnect_failures += 1
                        if reconnect_failures % 10 == 0:
                            print(f"[AI] ainda sem stream para {self.camera_id} (tentativa {reconnect_failures})")
                        time.sleep(min(5.0, 1.0 + reconnect_failures * 0.25))
                    continue

                start = time.time()
                try:
                    ret, frame = self.cap.read()
                except Exception as e:
                    print(f"[AI] Falha de leitura em {self.camera_id}: {e}")
                    ret, frame = False, None

                if not ret or frame is None:
                    self.cap.release()
                    self.cap = None
                    time.sleep(1)
                    continue

                self._process_frame(frame)

                elapsed = time.time() - start
                if elapsed < frame_interval:
                    time.sleep(frame_interval - elapsed)

        except Exception as e:
            # nunca deixar a thread morrer em silencio: o is_running() rely on self.running
            print(f"[AI] Loop de captura encerrado por erro em {self.camera_id}: {e}")
        finally:
            if self.cap is not None:
                self.cap.release()
                self.cap = None
            self.running = False
            print(f"[AI] Captura finalizada: {self.camera_id}")

    def start(self):
        if self.is_running():
            return
        self.running = True
        self.state = FallState()
        self.last_ts_ms = 0
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        self.thread = None

    def is_running(self):
        if not self.running:
            return False
        if self.thread is None or not self.thread.is_alive():
            self.running = False
            return False
        return True
