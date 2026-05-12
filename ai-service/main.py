from fastapi import FastAPI, BackgroundTasks
import httpx
import uvicorn
import os

app = FastAPI()

NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")

@app.post("/detect/{camera_id}")
async def detect_motion(camera_id: str, rtsp_url: str, background_tasks: BackgroundTasks):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{NEXTJS_URL}/api/alerts",
            json={"cameraId": camera_id, "type": "SUSPICIOUS_MOVEMENT"}
        )
    return {"status": "monitoring_started", "camera_id": camera_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
