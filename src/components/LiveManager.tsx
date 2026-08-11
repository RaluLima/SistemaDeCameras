"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Badge } from "@/components/ui/Badge";

type LiveStatus = "loading" | "live" | "error" | "unconfigured" | "nostream";

function LiveCard({ camera, onUnconfigured }: { camera: any; onUnconfigured: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<LiveStatus>("loading");

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

  return (
    <div className="bg-white dark:bg-dark-100 p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium dark:text-gray-100 truncate">{camera.name}</h3>
        {status === "live" ? (
          <Badge variant="success">AO VIVO</Badge>
        ) : status === "unconfigured" ? (
          <Badge variant="default">Sem servidor</Badge>
        ) : (
          <Badge variant="default">{camera.status}</Badge>
        )}
      </div>
      <div className="aspect-video bg-black rounded-md overflow-hidden relative">
        <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-contain" />
        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
            {status === "loading" && <p className="text-gray-300 text-sm">Conectando...</p>}
            {status === "nostream" && <p className="text-gray-400 text-sm">Sem URL de stream configurada</p>}
            {status === "error" && <p className="text-gray-300 text-sm">Falha ao carregar o stream</p>}
            {status === "unconfigured" && (
              <p className="text-gray-300 text-sm">
                Servidor de mídia (HLS) não configurado
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

  if (loading) return <div className="text-center py-8 text-gray-500">Carregando câmeras...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isAdmin ? "Câmeras ao Vivo" : "Minhas Câmeras ao Vivo"}
        </h1>
      </div>

      {unconfigured && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">
            🎥 Servidor de mídia (HLS) não configurado
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
            Defina a variável <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">LIVE_BASE_URL</code> apontando
            para um servidor Mediamtx (ou equivalente) que converta os streams RTSP em HLS para liberar a visualização.
          </p>
        </div>
      )}

      {cameras.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {isAdmin ? "Nenhuma câmera cadastrada ainda." : "Você ainda não possui câmeras."}
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
