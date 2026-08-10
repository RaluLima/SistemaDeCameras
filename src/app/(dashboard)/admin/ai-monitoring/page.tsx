"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

export default function AIMonitoringPage() {
  const { data: session } = useSession();
  const user = (session?.user as any) || {};
  const isAdmin = user.role === "ADMIN";
  const isPaying = isAdmin || user.plan === "PAID";
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCameras();
  }, []);

  async function fetchCameras() {
    try {
      const res = await fetch("/api/cameras");
      const data = await res.json();
      setCameras(data);
    } catch {
      toast.error("Erro ao carregar câmeras");
    } finally {
      setLoading(false);
    }
  }

  async function startMonitoring(cameraId: string, streamUrl: string) {
    if (!isPaying) return;
    try {
      const res = await fetch("/api/ai/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraId, streamUrl }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.status === "error" ? json.message : "Monitoramento iniciado");
      } else {
        toast.error(json.error || "Erro ao iniciar monitoramento");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  if (loading) return <p className="dark:text-gray-400">Carregando...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-gray-100">Monitoramento com IA</h1>

      {!isPaying && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">🔒 Recurso exclusivo do plano Pagante</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
            O monitoramento com inteligência artificial está disponível apenas para perfis pagantes. Contate o administrador para ativar seu plano.
          </p>
        </div>
      )}

      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {isPaying
          ? "Inicie o serviço Python para detecção real ou use o modo simulação."
          : "Você está no plano gratuito e não pode iniciar o monitoramento."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam: any) => (
          <div key={cam.id} className="bg-white dark:bg-dark-100 p-4 rounded-lg shadow">
            <h3 className="font-medium dark:text-gray-100">{cam.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{cam.streamUrl || "N/A"}</p>
            <button
              onClick={() => startMonitoring(cam.id, cam.streamUrl)}
              disabled={!isPaying}
              className={`mt-2 px-4 py-2 rounded ${isPaying ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-400 dark:bg-dark-200 dark:text-gray-500 cursor-not-allowed"}`}
            >
              Iniciar Monitoramento
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
