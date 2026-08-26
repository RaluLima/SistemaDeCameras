"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error";
  port?: number;
  pid?: number;
}

export default function ServersPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
    if (authStatus === "authenticated" && role !== "ADMIN") {
      router.push("/");
    }
  }, [authStatus, role, router]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/servers/status");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services);
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao verificar status" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === "ADMIN") {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [role, fetchStatus]);

  const toggleService = async (service: string) => {
    setToggling(service);
    setMessage(null);
    try {
      const res = await fetch("/api/servers/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, action: "toggle" }),
      });
      const data = await res.json();
      setMessage({ type: data.success ? "success" : "error", text: data.message });
      setTimeout(() => fetchStatus(), 1000);
    } catch {
      setMessage({ type: "error", text: "Erro ao alternar serviço" });
    } finally {
      setToggling(null);
    }
  };

  const startAll = async () => {
    setLoading(true);
    setMessage(null);
    try {
      for (const service of ["postgresql", "nextjs", "cloudflare"]) {
        await fetch("/api/servers/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, action: "start" }),
        });
      }
      setMessage({ type: "success", text: "Todos os serviços iniciados" });
      setTimeout(() => fetchStatus(), 2000);
    } catch {
      setMessage({ type: "error", text: "Erro ao iniciar serviços" });
    } finally {
      setLoading(false);
    }
  };

  const stopAll = async () => {
    setLoading(true);
    setMessage(null);
    try {
      for (const service of ["cloudflare", "nextjs", "postgresql"]) {
        await fetch("/api/servers/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, action: "stop" }),
        });
      }
      setMessage({ type: "success", text: "Todos os serviços parados" });
      setTimeout(() => fetchStatus(), 2000);
    } catch {
      setMessage({ type: "error", text: "Erro ao parar serviços" });
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === "loading" || role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500";
      case "stopped": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running": return "Rodando";
      case "stopped": return "Parado";
      default: return "Erro";
    }
  };

  const allRunning = services.every(s => s.status === "running");
  const allStopped = services.every(s => s.status === "stopped");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Painel de Servidores
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie os serviços do Camera Monitor
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === "success" 
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" 
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <button
            onClick={startAll}
            disabled={loading || allRunning}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Iniciar Todos
          </button>
          <button
            onClick={stopAll}
            disabled={loading || allStopped}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Parar Todos
          </button>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        <div className="grid gap-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="bg-white dark:bg-dark-100 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)} animate-pulse`}></div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {service.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Porta: {service.port || "N/A"}
                      {service.pid && ` · PID: ${service.pid}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    service.status === "running"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}>
                    {getStatusText(service.status)}
                  </span>
                  <button
                    onClick={() => toggleService(service.name.toLowerCase().replace(" ", ""))}
                    disabled={toggling === service.name.toLowerCase().replace(" ", "")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      service.status === "running"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    } disabled:opacity-50`}
                  >
                    {toggling === service.name.toLowerCase().replace(" ", "") ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processando...
                      </span>
                    ) : (
                      service.status === "running" ? "Parar" : "Iniciar"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Informações</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• PostgreSQL: Banco de dados na porta 5432</li>
            <li>• Next.js: Servidor web na porta 3000</li>
            <li>• Cloudflare Tunnel: Acesso público via internet</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
