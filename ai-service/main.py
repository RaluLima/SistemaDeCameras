from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form
import httpx
import uvicorn
import os
import numpy as np
import cv2
from detection import FallDetector, DetectionResult

app = FastAPI(title="Camera Monitor AI Service")

NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")

detectors: dict[str, FallDetector] = {}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/detect-frame")
async def detect_frame(file: UploadFile = File(...), camera_id: str = Form("webcam")):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"fall_detected": False, "motion_detected": False, "error": "invalid image"}

    if camera_id not in detectors:
        detectors[camera_id] = FallDetector()

    result: DetectionResult = detectors[camera_id].process_frame(frame)

    if result.fall_detected:
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{NEXTJS_URL}/api/alerts",
                    json={
                        "cameraId": camera_id,
                        "type": "FALL_DETECTED",
                        "description": f"Queda detectada via IA (confianca: {result.confidence:.0%})"
                    },
                    timeout=10.0
                )
            except httpx.RequestError:
                pass

    return {
        "fall_detected": result.fall_detected,
        "motion_detected": result.motion_detected,
        "confidence": result.confidence
    }

@app.post("/detect/{camera_id}")
async def detect_motion(camera_id: str, stream_url: str = Form(...), background_tasks: BackgroundTasks = None):
    result = await process_stream(camera_id, stream_url)
    return result

async def process_stream(camera_id: str, stream_url: str, duration: int = 30):
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        return {"status": "error", "message": "could not open stream"}

    detector = FallDetector()
    detectors[camera_id] = detector
    frame_count = 0
    fall_count = 0
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    max_frames = fps * duration

    while frame_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        if frame_count % 3 != 0:
            continue

        result = detector.process_frame(frame)
        if result.fall_detected:
            fall_count += 1
            async with httpx.AsyncClient() as client:
                try:
                    await client.post(
                        f"{NEXTJS_URL}/api/alerts",
                        json={
                            "cameraId": camera_id,
                            "type": "FALL_DETECTED",
                            "description": f"Queda detectada via stream (confianca: {result.confidence:.0%})"
                        },
                        timeout=10.0
                    )
                except httpx.RequestError:
                    pass

    cap.release()
    return {
        "status": "completed",
        "camera_id": camera_id,
        "frames_processed": frame_count,
        "falls_detected": fall_count
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
