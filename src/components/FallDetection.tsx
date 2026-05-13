"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";
import toast from "react-hot-toast";

const FALL_COOLDOWN = 5000;
const HORIZONTAL_ANGLE = 45;
const RAPID_DESCENT = 0.04;
const LONG_DOWN_TIMEOUT = 3000;

interface FallState {
  lastAlert: number;
  prevNoseY: number | null;
  velocityY: number;
  horizontalSince: number | null;
  alertCount: number;
}

interface AlertEntry {
  id: string;
  timestamp: string;
}

export function FallDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Pronto");
  const [logs, setLogs] = useState<AlertEntry[]>([]);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const fallState = useRef<FallState>({ lastAlert: 0, prevNoseY: null, velocityY: 0, horizontalSince: null, alertCount: 0 });
  const animRef = useRef<number>(0);

  const playAlert = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "square";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
      setTimeout(() => ctx.close(), 1000);
    } catch {}
  }, []);

  const detectFall = useCallback((landmarks: any[]): boolean => {
    const nose = landmarks[0];
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lh = landmarks[23];
    const rh = landmarks[24];
    if (!nose || !ls || !rs || !lh || !rh) return false;

    const s = fallState.current;
    const smy = (ls.y + rs.y) / 2;
    const hmy = (lh.y + rh.y) / 2;
    const smx = (ls.x + rs.x) / 2;
    const hmx = (lh.x + rh.x) / 2;
    const dx = hmx - smx;
    const dy = hmy - smy;
    const angle = Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));

    if (s.prevNoseY !== null) {
      s.velocityY = nose.y - s.prevNoseY;
    }
    s.prevNoseY = nose.y;

    const now = Date.now();
    const isHorizontal = angle > HORIZONTAL_ANGLE;
    const falling = s.velocityY > RAPID_DESCENT;

    if (isHorizontal) {
      if (s.horizontalSince === null) s.horizontalSince = now;
    } else {
      s.horizontalSince = null;
    }

    if (isHorizontal && falling && now - s.lastAlert > FALL_COOLDOWN) {
      s.lastAlert = now;
      s.velocityY = 0;
      s.alertCount++;
      return true;
    }

    if (isHorizontal && s.horizontalSince && now - s.horizontalSince > LONG_DOWN_TIMEOUT && now - s.lastAlert > FALL_COOLDOWN) {
      s.lastAlert = now;
      s.alertCount++;
      return true;
    }

    return false;
  }, []);

  const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";

  const sendFrameToAI = useCallback(async (video: HTMLVideoElement) => {
    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = 320;
      offscreen.height = 240;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, 320, 240);
      const blob = await new Promise<Blob | null>((r) => offscreen.toBlob(r, "image/jpeg", 0.7));
      if (!blob) return;
      const form = new FormData();
      form.append("file", blob, "frame.jpg");
      form.append("camera_id", "local-webcam");
      await fetch(`${AI_URL}/detect-frame`, { method: "POST", body: form });
    } catch {}
  }, [AI_URL]);

  const sendAlert = useCallback(async () => {
    playAlert();
    toast.error("⚠️ QUEDA DETECTADA!", { duration: 6000, id: "fall-alert" });
    const id = `fall-${Date.now()}`;
    setLogs((prev) => [{ id, timestamp: new Date().toLocaleTimeString() }, ...prev]);
    try {
      const camsRes = await fetch("/api/cameras");
      const cams = await camsRes.json();
      const camId = Array.isArray(cams) && cams.length > 0 ? cams[0].id : "local-webcam";
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: camId,
          type: "FALL_DETECTED",
          description: "Queda de pessoa detectada via webcam",
        }),
      });
    } catch {}
  }, [playAlert]);

  const start = useCallback(async () => {
    setStatus("Iniciando...");
    setActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const pose = new Pose({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults((results: any) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (results.poseLandmarks) {
          const mirrored = results.poseLandmarks.map((lm: any) => ({ ...lm, x: 1 - lm.x }));
          drawConnectors(ctx, mirrored, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
          drawLandmarks(ctx, mirrored, { color: "#FF0000", lineWidth: 1 });

          if (detectFall(mirrored)) {
            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            sendAlert();
          }
        }
      });

      poseRef.current = pose;

      const cam = new Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current && videoRef.current) {
            await poseRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      cameraRef.current = cam;
      cam.start();
      setStatus("Monitorando...");

      const ivl = setInterval(() => {
        if (videoRef.current) sendFrameToAI(videoRef.current);
      }, 2000);
      (window as any).__fallDetectionInterval = ivl;
    } catch (err) {
      toast.error("Erro ao acessar câmera: " + ((err as any)?.message || ""));
      setStatus("Erro");
      setActive(false);
    }
  }, [detectFall, sendAlert]);

  const stop = useCallback(() => {
    setActive(false);
    setStatus("Parado");
    if (cameraRef.current) {
      try { cameraRef.current.stop(); } catch {}
      cameraRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    poseRef.current = null;
    cancelAnimationFrame(animRef.current);
    clearInterval((window as any).__fallDetectionInterval);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{status}</span>
        </div>
        <div className="flex gap-2">
          {!active ? (
            <button onClick={start} className="btn-primary">
              ▶ Iniciar Monitoramento
            </button>
          ) : (
            <button onClick={stop} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
              ⬇ Parar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-lg overflow-hidden shadow-xl">
            <video ref={videoRef} playsInline className="hidden" />
            <canvas ref={canvasRef} className="w-full aspect-video" />
            {!active && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-gray-400 text-lg">
                {status === "Erro" ? "Erro ao acessar câmera" : "Clique em \"Iniciar Monitoramento\" para começar"}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Utilize sua webcam para testar a detecção de quedas em tempo real.
            Deite-se no chão rapidamente para simular uma queda.
          </p>
        </div>

        <div className="bg-white dark:bg-dark-100 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Registro de Quedas</h3>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma queda detectada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                  <span className="text-red-500">⚠️</span>
                  <span className="text-red-700 dark:text-red-300 font-medium">Queda detectada</span>
                  <span className="ml-auto text-gray-500 dark:text-gray-400 text-xs">{log.timestamp}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total: <strong className="text-gray-700 dark:text-gray-200">{fallState.current.alertCount}</strong> queda(s)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
