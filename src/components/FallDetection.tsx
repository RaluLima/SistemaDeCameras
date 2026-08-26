"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";
import { useSession } from "next-auth/react";
import Hls from "hls.js";
import toast from "react-hot-toast";

const FALL_COOLDOWN = 5000;
const HORIZONTAL_ANGLE = 45;
const RAPID_DESCENT = 0.04;
const LONG_DOWN_TIMEOUT = 3000;

type SourceType = "webcam" | "camera";

interface CameraOption {
  id: string;
  name: string;
  streamUrl: string | null;
}

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
  const { data: session, status: sessionStatus } = useSession();
  const sessionUser = (session?.user as any) || {};
  const isPaying = sessionUser.role === "ADMIN" || sessionUser.plan === "PAID";
  const sessionLoaded = sessionStatus === "authenticated";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Pronto");
  const [logs, setLogs] = useState<AlertEntry[]>([]);
  const [source, setSource] = useState<SourceType>("webcam");
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const poseRef = useRef<any>(null);
  const mpCameraRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fallState = useRef<FallState>({ lastAlert: 0, prevNoseY: null, velocityY: 0, horizontalSince: null, alertCount: 0 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const withStream = data.filter((c: CameraOption) => c.streamUrl);
          setCameras(withStream);
          if (withStream.length > 0 && !selectedCameraId) {
            setSelectedCameraId(withStream[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

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
    if (!isPaying) return;
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
      form.append("camera_id", source === "camera" ? selectedCameraId : "local-webcam");
      await fetch(`${AI_URL}/detect-frame`, { method: "POST", body: form });
    } catch {}
  }, [AI_URL, isPaying, source, selectedCameraId]);

  const sendAlert = useCallback(async () => {
    playAlert();
    toast.error("QUEDA DETECTADA!", { duration: 6000, id: "fall-alert" });
    const id = `fall-${Date.now()}`;
    setLogs((prev) => [{ id, timestamp: new Date().toLocaleTimeString() }, ...prev]);
    try {
      let camId = "local-webcam";
      let description = "Queda de pessoa detectada via webcam";
      if (source === "camera" && selectedCameraId) {
        const cam = cameras.find((c) => c.id === selectedCameraId);
        camId = selectedCameraId;
        description = `Queda de pessoa detectada na camera ${cam?.name || selectedCameraId}`;
      }
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraId: camId, type: "FALL_DETECTED", description }),
      });
    } catch {}
  }, [playAlert, source, selectedCameraId, cameras]);

  const setupPose = useCallback((mirror: boolean) => {
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

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mirror) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      if (results.poseLandmarks) {
        const landmarks = mirror
          ? results.poseLandmarks.map((lm: any) => ({ ...lm, x: 1 - lm.x }))
          : results.poseLandmarks;
        drawConnectors(ctx, landmarks, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1 });

        if (detectFall(landmarks)) {
          ctx.strokeStyle = "#FF0000";
          ctx.lineWidth = 4;
          ctx.strokeRect(0, 0, canvas.width, canvas.height);
          sendAlert();
        }
      }
    });
    poseRef.current = pose;
    return pose;
  }, [detectFall, sendAlert]);

  const activeRef = useRef(false);

  const startWebcam = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    const pose = setupPose(true);

    const cam = new Camera(videoRef.current, {
      onFrame: async () => {
        if (poseRef.current && videoRef.current) {
          await poseRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });
    mpCameraRef.current = cam;
    cam.start();
  }, [setupPose]);

  const startCamera = useCallback(async () => {
    const cam = cameras.find((c) => c.id === selectedCameraId);
    if (!cam || !cam.streamUrl) {
      throw new Error("Camera sem URL de stream configurada");
    }
    if (!videoRef.current) return;

    const hlsUrl = `/api/live/${cam.id}/index.m3u8`;

    return new Promise<void>((resolve, reject) => {
      const video = videoRef.current!;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setupPose(false);
          const tick = async () => {
            if (poseRef.current && videoRef.current && activeRef.current) {
              await poseRef.current.send({ image: videoRef.current });
            }
            if (activeRef.current) {
              animRef.current = requestAnimationFrame(tick);
            }
          };
          tick();
          resolve();
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            reject(new Error("Falha ao carregar stream HLS"));
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.addEventListener("loadedmetadata", () => {
          video.play().catch(() => {});
          setupPose(false);
          const tick = async () => {
            if (poseRef.current && videoRef.current && activeRef.current) {
              await poseRef.current.send({ image: videoRef.current });
            }
            if (activeRef.current) {
              animRef.current = requestAnimationFrame(tick);
            }
          };
          tick();
          resolve();
        });
      } else {
        reject(new Error("Seu navegador nao suporta HLS"));
      }
    });
  }, [cameras, selectedCameraId, setupPose]);

  const start = useCallback(async () => {
    setStatus("Iniciando...");
    setActive(true);
    activeRef.current = true;

    try {
      if (source === "webcam") {
        await startWebcam();
      } else {
        await startCamera();
      }
      setStatus("Monitorando...");

      const ivl = setInterval(() => {
        if (videoRef.current) sendFrameToAI(videoRef.current);
      }, 2000);
      (window as any).__fallDetectionInterval = ivl;
    } catch (err) {
      toast.error("Erro ao iniciar: " + ((err as any)?.message || ""));
      setStatus("Erro");
      setActive(false);
    }
  }, [source, startWebcam, startCamera, sendFrameToAI]);

  const stop = useCallback(() => {
    setActive(false);
    activeRef.current = false;
    setStatus("Parado");

    if (mpCameraRef.current) {
      try { mpCameraRef.current.stop(); } catch {}
      mpCameraRef.current = null;
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (videoRef.current) {
      videoRef.current.src = "";
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
      {sessionLoaded && !isPaying && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            O processamento com IA no servidor e exclusivo do plano Pagante. A deteccao local (webcam) continua disponivel para demonstracao.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{status}</span>
        </div>
        <div className="flex gap-2">
          {!active ? (
            <button onClick={start} className="btn-primary">
              Iniciar Monitoramento
            </button>
          ) : (
            <button onClick={stop} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
              Parar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fonte:</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => !active && setSource("webcam")}
              disabled={active}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                source === "webcam"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              } ${active ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Webcam
            </button>
            <button
              onClick={() => !active && setSource("camera")}
              disabled={active}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                source === "camera"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              } ${active ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Camera Cadastrada
            </button>
          </div>
        </div>

        {source === "camera" && !active && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Camera:</label>
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 text-sm"
            >
              {cameras.length === 0 && <option value="">Nenhuma camera com stream</option>}
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>{cam.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-lg overflow-hidden shadow-xl">
            <video ref={videoRef} playsInline muted className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none" />
            <canvas ref={canvasRef} className="w-full aspect-video" />
            {!active && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-gray-400 text-lg">
                {status === "Erro" ? "Erro ao acessar camera" : "Selecione a fonte e clique em \"Iniciar Monitoramento\" para comecar"}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {source === "webcam"
              ? "Utilize sua webcam para testar a deteccao de quedas em tempo real."
              : "Utilize uma camera cadastrada com stream RTSP para monitorar quedas."
            }
            {" "}Deite-se no chao rapidamente para simular uma queda.
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
                  <span className="text-red-500">!</span>
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
