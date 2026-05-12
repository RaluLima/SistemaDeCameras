"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function AIMonitoringPage() {
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

  async function startMonitoring(cameraId: string, rtspUrl: string) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000"}/detect/${cameraId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtsp_url: rtspUrl }),
      });
      toast.success("Monitoramento iniciado");
    } catch {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraId, type: "SUSPICIOUS_MOVEMENT" }),
      });
      toast.success("Alerta de teste gerado (serviço IA offline)");
    }
  }

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Monitoramento com IA</h1>
      <p className="text-gray-600 mb-4">Inicie o serviço Python para detecção real ou use o modo simulação.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam: any) => (
          <div key={cam.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-medium">{cam.name}</h3>
            <p className="text-sm text-gray-500 truncate">{cam.rtspUrl}</p>
            <button onClick={() => startMonitoring(cam.id, cam.rtspUrl)} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Iniciar Monitoramento
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
