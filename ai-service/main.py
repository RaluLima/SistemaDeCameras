import os
import time
import json
import threading
import httpx
import asyncio
import uvicorn
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.concurrency import run_in_threadpool
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
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "active_monitors.json")

monitors: Dict[str, FallDetector] = {}

try:
    import redis as redis_lib
    redis_client = redis_lib.from_url(REDIS_URL, decode_responses=True, protocol=2)
    redis_client.ping()
    print(f"[AI] Redis conectado: {REDIS_URL}")
except Exception as e:
    redis_client = None
    print(f"[AI] Redis indisponivel: {e}")

class StartMonitorRequest(BaseModel):
    camera_id: str
    rtsp_url: str

class StopMonitorRequest(BaseModel):
    camera_id: str

def _load_saved_monitors() -> Dict[str, str]:
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return {k: v for k, v in data.items() if isinstance(v, str) and v}
    except Exception as e:
        print(f"[AI] Erro ao ler {STATE_FILE}: {e}")
    return {}

def _save_monitors():
    try:
        payload = {
            cid: m.rtsp_url
            for cid, m in monitors.items()
            if m.is_running()
        }
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        os.replace(tmp, STATE_FILE)
    except Exception as e:
        print(f"[AI] Erro ao salvar estado dos monitores: {e}")

def start_detector(camera_id: str, rtsp_url: str, persist: bool = True):
    existing = monitors.get(camera_id)
    if existing is not None and existing.is_running():
        return "already_running", existing

    if existing is not None:
        try:
            existing.stop()
        except Exception:
            pass
        monitors.pop(camera_id, None)

    def on_fall(cid: str, alert_count: int):
        threading.Thread(target=send_alert_sync, args=(cid, alert_count), daemon=True).start()

    detector = FallDetector(camera_id=camera_id, rtsp_url=rtsp_url, on_fall=on_fall)
    monitors[camera_id] = detector
    detector.start()
    if persist:
        _save_monitors()
    return "started", detector

def restore_monitors():
    saved = _load_saved_monitors()
    if not saved:
        print("[AI] Nenhum monitor salvo para restaurar")
        return
    print(f"[AI] Restaurando {len(saved)} monitor(es) salvo(s)...")
    for camera_id, rtsp_url in saved.items():
        try:
            start_detector(camera_id, rtsp_url, persist=False)
            print(f"[AI] Monitor restaurado: {camera_id} -> {rtsp_url}")
        except Exception as e:
            print(f"[AI] Falha ao restaurar {camera_id}: {e}")
    _save_monitors()

@app.on_event("startup")
async def on_startup():
    threading.Thread(target=restore_monitors, daemon=True).start()

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
                if redis_client:
                    try:
                        import json
                        redis_client.publish("alerts", json.dumps({
                            "cameraId": camera_id,
                            "type": "FALL_DETECTED",
                            "description": f"Queda detectada pelo servidor de IA (alerta #{alert_count})",
                        }))
                        print(f"[AI] Alerta publicado no Redis")
                    except Exception as e:
                        print(f"[AI] Erro ao publicar no Redis: {e}")
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
    status, _ = start_detector(req.camera_id, req.rtsp_url)
    return {"status": status, "camera_id": req.camera_id, "rtsp_url": req.rtsp_url}

@app.post("/stop")
async def stop_monitor(req: StopMonitorRequest):
    detector = monitors.get(req.camera_id)
    if detector is None:
        _save_monitors()
        return {"status": "not_found", "camera_id": req.camera_id}

    detector.stop()
    monitors.pop(req.camera_id, None)
    _save_monitors()
    return {"status": "stopped", "camera_id": req.camera_id}

@app.post("/stop-all")
async def stop_all():
    for m in list(monitors.values()):
        m.stop()
    monitors.clear()
    _save_monitors()
    return {"status": "all_stopped"}

# Um detector por camera para o endpoint frame-a-frame, reutilizado entre requisicoes
# (a logica de queda depende do historico de quadros anteriores).
# NAO usar a API legada mp.solutions.* aqui: inicializa-la corrompe a resolucao do
# caminho do modelo do MediaPipe Tasks ("Unable to open file at ...site-packages/D:\...")
# e qualquer FallDetector criado depois passa a falhar.
_frame_detectors: Dict[str, FallDetector] = {}
_frame_detectors_lock = threading.Lock()

def _get_frame_detector(camera_id: str) -> FallDetector:
    with _frame_detectors_lock:
        det = _frame_detectors.get(camera_id)
        if det is None:
            det = FallDetector(camera_id=camera_id, rtsp_url="")
            _frame_detectors[camera_id] = det
        return det

@app.post("/detect-frame")
async def detect_frame(file: UploadFile = File(...), camera_id: str = Form("unknown")):
    import cv2
    import numpy as np

    # "file" precisa ser UploadFile/File(...): um parametro "bytes" simples e
    # interpretado como Query param pelo FastAPI e o multipart do navegador e ignorado.
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="No frame provided")

    nparr = np.frombuffer(data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid frame")

    detector = _get_frame_detector(camera_id)
    # _process_frame e CPU-bound: roda em thread para nao travar o event loop do uvicorn
    detected, _ = await run_in_threadpool(detector._process_frame, frame)
    if detected:
        threading.Thread(
            target=send_alert_sync, args=(camera_id, detector.state.alert_count), daemon=True
        ).start()

    return {"detected": detected, "camera_id": camera_id}

if __name__ == "__main__":
    print("=" * 50)
    print("  CamView AI Service")
    print(f"  Next.js URL: {NEXTJS_URL}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
