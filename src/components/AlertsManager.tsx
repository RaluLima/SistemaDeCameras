"use client";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";

interface AlertItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  processed: boolean;
  camera: { name: string };
}

const TYPE_META: Record<string, { label: string; icon: string }> = {
  FALL_DETECTED: { label: "Queda", icon: "⚠️" },
  INTRUSION: { label: "Intrusão", icon: "🚨" },
  SUSPICIOUS_MOVEMENT: { label: "Movimento suspeito", icon: "👀" },
  CONNECTION_LOST: { label: "Conexão perdida", icon: "📡" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AlertsManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) setAlerts(await res.json());
    } catch {
      toast.error("Erro ao carregar alertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  async function markAsRead(id: string) {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processed: true }),
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, processed: true } : a)));
      } else {
        toast.error("Erro ao marcar alerta como lido");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  const unread = alerts.filter((a) => !a.processed).length;

  if (loading) return <div className="text-center py-8 text-gray-500">Carregando alertas...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isAdmin ? "Alertas" : "Meus Alertas"}
        </h1>
        {unread > 0 && (
          <Badge variant="destructive">
            {unread} não lido{unread > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">Nenhum alerta registrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const meta = TYPE_META[alert.type] || { label: alert.type, icon: "🔔" };
            return (
              <div
                key={alert.id}
                className={`card p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                  alert.processed ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{meta.label}</span>
                      <span className="text-xs text-gray-400">{alert.camera.name}</span>
                      {!alert.processed && <Badge variant="destructive">Nova</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{alert.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(alert.timestamp)}
                  </span>
                  {!alert.processed && (
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap"
                    >
                      ✓ Marcar como lida
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
