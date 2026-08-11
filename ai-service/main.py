import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

import cv2
import httpx
import numpy as np
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from detection import FallDetector, DetectionResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "")
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", "5")) * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
DETECTOR_TTL = int(os.getenv("DETECTOR_TTL", "300"))
CLEANUP_INTERVAL = int(os.getenv("CLEANUP_INTERVAL", "60"))

detectors: dict[str, dict] = {}
_cleanup_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cleanup_task
    _cleanup_task = asyncio.create_task(_periodic_cleanup())
    logger.info("AI Service started")
    yield
    if _cleanup_task:
        _cleanup_task.cancel()
    logger.info("AI Service stopped")


app = FastAPI(title="Camera Monitor AI Service", version="2.0.0", lifespan=lifespan)


async def _periodic_cleanup():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        now = time.time()
        stale = [cid for cid, info in detectors.items()
                 if now - info["last_access"] > DETECTOR_TTL]
        for cid in stale:
            logger.info(f"Cleaning up stale detector: {cid}")
            del detectors[cid]
        if stale:
            logger.info(f"Cleanup removed {len(stale)} stale detector(s)")


def _get_or_create_detector(camera_id: str) -> FallDetector:
    if camera_id not in detectors:
        logger.info(f"Creating new detector for camera: {camera_id}")
        detectors[camera_id] = {
            "instance": FallDetector(camera_id=camera_id),
            "last_access": time.time(),
        }
    detectors[camera_id]["last_access"] = time.time()
    return detectors[camera_id]["instance"]


def _validate_image(contents: bytes) -> np.ndarray:
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Max {MAX_IMAGE_SIZE // (1024*1024)}MB",
        )
    if len(contents) < 100:
        raise HTTPException(status_code=400, detail="Image too small or empty")

    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="Could not decode image")

    h, w = frame.shape[:2]
    if h < 20 or w < 20:
        raise HTTPException(status_code=400, detail="Image dimensions too small")

    return frame


async def _send_alert(camera_id: str, description: str, retries: int = 2):
    headers = {"x-service-key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {}
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{NEXTJS_URL}/api/alerts",
                    headers=headers,
                    json={
                        "cameraId": camera_id,
                        "type": "FALL_DETECTED",
                        "description": description,
                    },
                )
                if resp.is_success:
                    logger.info(f"Alert sent for camera {camera_id}")
                    return
                logger.warning(f"Alert API returned {resp.status_code} (attempt {attempt + 1})")
        except httpx.RequestError as e:
            logger.warning(f"Alert send failed (attempt {attempt + 1}): {e}")
            if attempt < retries:
                await asyncio.sleep(1.0)
    logger.error(f"Failed to send alert for camera {camera_id} after {retries + 1} attempts")


@app.get("/health")
async def health():
    active = len(detectors)
    total_persons = sum(
        len([t for t in d["instance"].tracks.values() if t.missed_frames == 0])
        for d in detectors.values()
    )
    return {
        "status": "ok",
        "version": "2.0.0",
        "active_detectors": active,
        "total_persons_tracked": total_persons,
        "uptime_seconds": _get_uptime(),
    }


_uptime_start = time.time()


def _get_uptime():
    return int(time.time() - _uptime_start)


@app.post("/detect-frame")
async def detect_frame(
    file: UploadFile = File(...),
    camera_id: str = Form("default"),
    min_confidence: float = Form(0.0),
):
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type: {file.content_type}. "
                   f"Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    contents = await file.read()
    frame = _validate_image(contents)

    detector = _get_or_create_detector(camera_id)
    result: DetectionResult = detector.process_frame(frame)

    if result.fall_detected and result.confidence >= min_confidence:
        description = (
            f"Queda detectada (confianca: {result.confidence:.0%}, "
            f"pessoas: {result.persons_detected})"
        )
        asyncio.create_task(_send_alert(camera_id, description))

    return {
        "fall_detected": result.fall_detected,
        "motion_detected": result.motion_detected,
        "confidence": round(result.confidence, 4),
        "persons_detected": result.persons_detected,
    }


@app.post("/detect/{camera_id}")
async def detect_stream(
    camera_id: str,
    stream_url: str = Form(...),
    duration: int = Form(30),
):
    result = await process_stream(camera_id, stream_url, duration)
    return result


async def process_stream(camera_id: str, stream_url: str, duration: int = 30):
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        return {"status": "error", "message": "Could not open stream"}

    detector = _get_or_create_detector(camera_id)
    frame_count = 0
    fall_count = 0
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    max_frames = fps * duration

    try:
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
                description = (
                    f"Queda detectada via stream (confianca: {result.confidence:.0%}, "
                    f"pessoas: {result.persons_detected})"
                )
                await _send_alert(camera_id, description)

    finally:
        cap.release()

    return {
        "status": "completed",
        "camera_id": camera_id,
        "frames_processed": frame_count,
        "falls_detected": fall_count,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception(f"Unhandled exception on {request.method} {request.url}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
