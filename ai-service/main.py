import os
import time
import threading
import httpx
import asyncio
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
from detector import FallDetector

app = FastAPI(title="CamView AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")
AI_SECRET = os.getenv("AI_SECRET", "camview-ai-secret-2024")

monitors: Dict[str, FallDetector] = {}

class StartMonitorRequest(BaseModel):
    camera_id: str
    rtsp_url: str

class StopMonitorRequest(BaseModel):
    camera_id: str

def send_alert_sync(camera_id: str, alert_count: int):
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                f"{NEXTJS_URL}/api/alerts",
                json={
                    "cameraId": camera_id,
                    "type": "FALL_DETECTED",
                    "description": f"Queda detectada pelo servidor de IA (alerta #{alert_count})",
                },
                headers={"x-service-key": AI_SECRET},
            )
            if resp.status_code in (200, 201):
                print(f"[AI] Alerta enviado com sucesso para camera {camera_id}")
            else:
                print(f"[AI] Erro ao enviar alerta: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"[AI] Falha ao enviar alerta: {e}")

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "camview-ai",
        "monitors_active": len([m for m in monitors.values() if m.is_running()]),
    }

@app.get("/monitors")
async def list_monitors():
    return {
        camera_id: {
            "camera_id": m.camera_id,
            "rtsp_url": m.rtsp_url,
            "running": m.is_running(),
            "alert_count": m.state.alert_count,
        }
        for camera_id, m in monitors.items()
    }

@app.post("/start")
async def start_monitor(req: StartMonitorRequest):
    if req.camera_id in monitors and monitors[req.camera_id].is_running():
        return {"status": "already_running", "camera_id": req.camera_id}

    def on_fall(camera_id: str, alert_count: int):
        threading.Thread(
            target=send_alert_sync,
            args=(camera_id, alert_count),
            daemon=True,
        ).start()

    detector = FallDetector(
        camera_id=req.camera_id,
        rtsp_url=req.rtsp_url,
        on_fall=on_fall,
    )
    monitors[req.camera_id] = detector
    detector.start()

    return {"status": "started", "camera_id": req.camera_id, "rtsp_url": req.rtsp_url}

@app.post("/stop")
async def stop_monitor(req: StopMonitorRequest):
    if req.camera_id not in monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")

    monitors[req.camera_id].stop()
    return {"status": "stopped", "camera_id": req.camera_id}

@app.post("/stop-all")
async def stop_all():
    for m in monitors.values():
        m.stop()
    return {"status": "all_stopped"}

@app.post("/detect-frame")
async def detect_frame(file: bytes = None, camera_id: str = "unknown"):
    import cv2
    import numpy as np
    import mediapipe as mp

    if not file:
        raise HTTPException(status_code=400, detail="No frame provided")

    nparr = np.frombuffer(file, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid frame")

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(model_complexity=1, min_detection_confidence=0.5, min_tracking_confidence=0.5)

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose.process(rgb)

    detected = False
    if results.pose_landmarks:
        from detector import FallDetector as FD
        detector = FD(camera_id=camera_id, rtsp_url="")
        detected = detector.detect_fall(results.pose_landmarks.landmark)
        if detected:
            send_alert_sync(camera_id, detector.state.alert_count)

    return {"detected": detected, "camera_id": camera_id}

if __name__ == "__main__":
    print("=" * 50)
    print("  CamView AI Service")
    print(f"  Next.js URL: {NEXTJS_URL}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
