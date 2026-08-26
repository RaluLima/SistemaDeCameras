"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Badge } from "@/components/ui/Badge";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

type LiveStatus = "loading" | "live" | "error" | "unconfigured" | "nostream";

const FALL_COOLDOWN = 5000;
const HORIZONTAL_ANGLE = 45;
const RAPID_DESCENT = 0.04;
const LONG_DOWN_TIMEOUT = 3000;

interface FallState {
  lastAlert: number;
  prevNoseY: number | null;
  velocityY: number;
  horizontalSince: number | null;
}

function LiveCard({ camera, onUnconfigured }: { camera: any; onUnconfigured: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [detecting, setDetecting] = useState(false);
  const poseRef = useRef<Pose | null>(null);
  const animRef = useRef<number>(0);
  const fallState = useRef<FallState>({ lastAlert: 0, prevNoseY: null, velocityY: 0, horizontalSince: null });
  const [fallCount, setFallCount] = useState(0);
  const detectingRef = useRef(false);

  const src = `/api/live/${camera.id}/index.m3u8`;

  useEffect(() => {
    if (!camera.streamUrl) {
      setStatus("nostream");
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("live");
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        const statusCode = (data.response as any)?.status;
        if (!data.fatal) return;
        if (statusCode === 503) {
          setStatus("unconfigured");
          onUnconfigured();
        } else if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
          setStatus("error");
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls?.startLoad();
        } else {
          hls?.destroy();
          setStatus("error");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        setStatus("live");
        video.play().catch(() => {});
      });
      video.addEventListener("error", () => setStatus("error"));
    } else {
      setStatus("error");
    }

    return () => {
      if (hls) hls.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.id]);

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
      return true;
    }

    if (isHorizontal && s.horizontalSince && now - s.horizontalSince > LONG_DOWN_TIMEOUT && now - s.lastAlert > FALL_COOLDOWN) {
      s.lastAlert = now;
      return true;
    }

    return false;
  }, []);

  const startDetection = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

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
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!c || !v) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;

      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) return;
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;

      ctx.clearRect(0, 0, c.width, c.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
        drawLandmarks(ctx, results.poseLandmarks, { color: "#FF0000", lineWidth: 1 });

        if (detectFall(results.poseLandmarks)) {
          ctx.strokeStyle = "#FF0000";
          ctx.lineWidth = 4;
          ctx.strokeRect(0, 0, c.width, c.height);
          setFallCount((prev) => prev + 1);
          try {
            fetch("/api/alerts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cameraId: camera.id,
                type: "FALL_DETECTED",
                description: `Queda detectada na camera ${camera.name} (ao vivo)`,
              }),
            });
          } catch {}
        }
      }
    });

    poseRef.current = pose;

    const tick = async () => {
      if (poseRef.current && videoRef.current && detectingRef.current) {
        try {
          await poseRef.current.send({ image: videoRef.current });
        } catch {}
      }
      if (detectingRef.current) {
        animRef.current = requestAnimationFrame(tick);
      }
    };
    tick();
  }, [camera.id, camera.name, detectFall]);

  const toggleDetection = useCallback(() => {
    setDetecting((prev) => {
      const next = !prev;
      detectingRef.current = next;
      if (next) {
        setTimeout(() => startDetection(), 100);
      } else {
        poseRef.current = null;
        cancelAnimationFrame(animRef.current);
        const c = canvasRef.current;
        if (c) {
          const ctx = c.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        }
      }
      return next;
    });
  }, [startDetection]);

  useEffect(() => {
    return () => {
      poseRef.current = null;
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const hasAI = camera.aiMonitoringEnabled;

  return (
    <div className="bg-white dark:bg-dark-100 p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium dark:text-gray-100 truncate">{camera.name}</h3>
        <div className="flex items-center gap-2">
          {hasAI && status === "live" && (
            <button
              onClick={toggleDetection}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                detecting
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              title={detecting ? "Parar deteccao" : "Iniciar deteccao de quedas"}
            >
              {detecting ? "IA Ativa" : "IA"}
            </button>
          )}
          {status === "live" ? (
            <Badge variant="success">AO VIVO</Badge>
          ) : status === "unconfigured" ? (
            <Badge variant="default">Sem servidor</Badge>
          ) : (
            <Badge variant="default">{camera.status}</Badge>
          )}
        </div>
      </div>
      <div className="aspect-video bg-black rounded-md overflow-hidden relative">
        <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        {detecting && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">IA Monitorando</span>
          </div>
        )}
        {detecting && fallCount > 0 && (
          <div className="absolute top-2 right-2 bg-red-600/80 rounded px-2 py-1">
            <span className="text-xs text-white font-medium">{fallCount} queda(s)</span>
          </div>
        )}
        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
            {status === "loading" && <p className="text-gray-300 text-sm">Conectando...</p>}
            {status === "nostream" && <p className="text-gray-400 text-sm">Sem URL de stream configurada</p>}
            {status === "error" && <p className="text-gray-300 text-sm">Falha ao carregar o stream</p>}
            {status === "unconfigured" && (
              <p className="text-gray-300 text-sm">
                Servidor de midia (HLS) nao configurado
              </p>
            )}
          </div>
        )}
      </div>
      {camera.streamUrl && (
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-2">{camera.streamUrl}</p>
      )}
    </div>
  );
}

export function LiveManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unconfigured, setUnconfigured] = useState(false);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCameras)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-500">Carregando cameras...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isAdmin ? "Cameras ao Vivo" : "Minhas Cameras ao Vivo"}
        </h1>
      </div>

      {unconfigured && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">
            Servidor de midia (HLS) nao configurado
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
            Defina a variavel <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">LIVE_BASE_URL</code> apontando
            para um servidor Mediamtx (ou equivalente) que converta os streams RTSP em HLS para liberar a visualizacao.
          </p>
        </div>
      )}

      {cameras.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">Sinal</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {isAdmin ? "Nenhuma camera cadastrada ainda." : "Voce ainda nao possui cameras."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((cam) => (
            <LiveCard key={cam.id} camera={cam} onUnconfigured={() => setUnconfigured(true)} />
          ))}
        </div>
      )}
    </div>
  );
}
