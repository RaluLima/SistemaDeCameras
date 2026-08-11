"use client";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface Recording {
  id: string;
  cameraId: string;
  alertId: string | null;
  filePath: string;
  duration: number;
  size: number;
  createdAt: string;
  camera: { name: string; retentionDays: number };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordingsManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<Recording | null>(null);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cameraId) params.set("cameraId", cameraId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", "100");
      const res = await fetch(`/api/recordings?${params.toString()}`);
      if (res.ok) setRecordings(await res.json());
    } catch {
      toast.error("Erro ao carregar gravações");
    } finally {
      setLoading(false);
    }
  }, [cameraId, from, to]);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCameras)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isAdmin ? "Todas as Gravações" : "Minhas Gravações"}
        </h1>
      </div>

      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <select
          value={cameraId}
          onChange={(e) => setCameraId(e.target.value)}
          className="input-field sm:w-56"
        >
          <option value="">Todas as câmeras</option>
          {cameras.map((cam) => (
            <option key={cam.id} value={cam.id}>{cam.name}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="input-field sm:w-56"
          aria-label="De"
        />
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="input-field sm:w-56"
          aria-label="Até"
        />
        <button onClick={fetchRecordings} className="btn-primary text-sm whitespace-nowrap">
          Filtrar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando gravações...</div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">🎬</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Nenhuma gravação encontrada para os filtros selecionados.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Habilite a gravação em uma câmera e aguarde o worker registrar os segmentos.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-dark-200">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Câmera</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Duração</th>
                <th className="px-4 py-3 font-medium">Tamanho</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {recordings.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-dark-200/50">
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                    <span className="flex items-center gap-2">
                      {rec.camera.name}
                      {rec.alertId && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 px-2 py-0.5 rounded">
                          ⚠ Alerta
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(rec.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDuration(rec.duration)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatSize(rec.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setPlaying(rec)}
                        className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 px-2.5 py-1 rounded-md text-xs font-medium"
                      >
                        ▶ Reproduzir
                      </button>
                      <a
                        href={`/api/recordings/file/${rec.id}?download=1`}
                        className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-md text-xs font-medium"
                      >
                        ⬇ Baixar
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {playing && (
        <div className="modal-overlay" onClick={() => setPlaying(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {playing.camera.name} — {formatDate(playing.createdAt)}
              </h2>
              <button
                onClick={() => setPlaying(null)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <video
              key={playing.id}
              src={`/api/recordings/file/${playing.id}`}
              controls
              autoPlay
              className="w-full rounded-lg bg-black aspect-video"
            />
          </div>
        </div>
      )}
    </div>
  );
}
