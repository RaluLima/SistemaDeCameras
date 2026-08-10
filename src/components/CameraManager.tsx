"use client";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { CameraCard } from "@/components/CameraCard";

const cameraTypes = [
  { value: "IP", label: "IP (RTSP)", description: "Câmera de rede com stream RTSP" },
  { value: "USB", label: "USB", description: "Webcam ou câmera USB local" },
  { value: "WIRELESS", label: "Wireless", description: "Câmera Wi-Fi / sem fio" },
  { value: "ANALOG", label: "Analógica", description: "Câmera analógica via DVR" },
  { value: "OTHER", label: "Outro", description: "Outro tipo de câmera" },
];

const retentionOptions = [7, 15, 30, 60, 90];

interface FormData {
  name: string;
  type: string;
  streamUrl: string;
  status: string;
  retentionDays: number;
  recordingEnabled: boolean;
  aiMonitoringEnabled: boolean;
}

const emptyForm: FormData = { name: "", type: "IP", streamUrl: "", status: "ACTIVE", retentionDays: 30, recordingEnabled: false, aiMonitoringEnabled: false };

export function CameraManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("FREE");

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch("/api/cameras");
      if (res.ok) setCameras(await res.json());
    } catch {
      toast.error("Erro ao carregar câmeras");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => me?.plan && setUserPlan(me.plan))
      .catch(() => {});
  }, [fetchCameras]);

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(cam: any) {
    setForm({ name: cam.name, type: cam.type, streamUrl: cam.streamUrl || "", status: cam.status, retentionDays: cam.retentionDays || 30, recordingEnabled: cam.recordingEnabled || false, aiMonitoringEnabled: cam.aiMonitoringEnabled || false });
    setEditingId(cam.id);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/cameras/${editingId}` : "/api/cameras";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editingId ? "Câmera atualizada" : "Câmera adicionada");
        setShowModal(false);
        fetchCameras();
      } else {
        const json = await res.json();
        toast.error(json.error || "Erro ao salvar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover câmera "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/cameras/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Câmera removida");
        fetchCameras();
      } else {
        const json = await res.json();
        toast.error(json.error || "Erro ao remover");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  async function handleCleanup() {
    if (!confirm("Remover todas as gravações fora do período de retenção de cada câmera?")) return;
    try {
      const res = await fetch("/api/recordings/cleanup", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        toast.success(`${json.deleted} gravação(ões) antiga(s) removida(s)`);
      } else {
        toast.error(json.error || "Erro ao limpar gravações");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  const typeIcon: Record<string, string> = { IP: "🌐", USB: "🔌", WIRELESS: "📡", ANALOG: "📺", OTHER: "📹" };

  if (loading) return <div className="text-center py-8 text-gray-500">Carregando câmeras...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isAdmin ? "Todas as Câmeras" : "Minhas Câmeras"}
        </h1>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={handleCleanup} className="btn-outline whitespace-nowrap text-sm">
              🧹 Limpar gravações antigas
            </button>
          )}
          <button onClick={openAdd} className="btn-primary whitespace-nowrap">
            + Nova Câmera
          </button>
        </div>
      </div>

      {cameras.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📷</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
            {isAdmin ? "Nenhuma câmera cadastrada ainda." : "Você ainda não possui câmeras."}
          </p>
          <button onClick={openAdd} className="btn-primary">
            Adicionar primeira câmera
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((cam) => (
            <div key={cam.id} className="relative group">
              <CameraCard camera={cam} isAdmin={isAdmin} />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(cam)} className="bg-white/90 p-1.5 rounded shadow hover:bg-white" title="Editar">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(cam.id, cam.name)} className="bg-white/90 p-1.5 rounded shadow hover:bg-white" title="Remover">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{editingId ? "Editar Câmera" : "Nova Câmera"}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input-field" placeholder="Ex: Câmera da Entrada" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cameraTypes.map((t) => (
                    <label key={t.value} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${form.type === t.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-200"}`}>
                      <input type="radio" name="type" value={t.value} checked={form.type === t.value} onChange={(e) => setForm({ ...form, type: e.target.value })} className="sr-only" />
                      <span className="text-lg">{typeIcon[t.value]}</span>
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{t.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  URL do Stream {form.type === "IP" ? "(RTSP) *" : "(opcional)"}
                </label>
                <input
                  value={form.streamUrl}
                  onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                  required={form.type === "IP"}
                  className="input-field"
                  placeholder={form.type === "IP" ? "rtsp://192.168.1.100:554/stream" : form.type === "USB" ? "/dev/video0" : "URL ou identificador"}
                />
                {form.type !== "IP" && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Deixe em branco se não houver URL de stream.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                  <option value="ACTIVE">Ativa</option>
                  <option value="INACTIVE">Inativa</option>
                  <option value="ERROR">Erro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Período de retenção das gravações</label>
                <select value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })} className="input-field">
                  {retentionOptions.map((days) => (
                    <option key={days} value={days}>{days} dias</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">As gravações mais antigas que este período são removidas automaticamente.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modo de operação</label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${form.recordingEnabled ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-200"}`}>
                    <input type="checkbox" checked={form.recordingEnabled} onChange={(e) => setForm({ ...form, recordingEnabled: e.target.checked })} className="mt-1 accent-green-600" />
                    <div>
                      <p className="text-sm font-medium">📹 Gravar gravações</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Captura contínua do stream, mantida por {form.retentionDays} dias. Requer URL de stream válida.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${form.aiMonitoringEnabled ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : isAdmin || userPlan === "PAID" ? "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-200" : "border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"}`}>
                    <input type="checkbox" checked={form.aiMonitoringEnabled} disabled={!isAdmin && userPlan !== "PAID"} onChange={(e) => setForm({ ...form, aiMonitoringEnabled: e.target.checked })} className="mt-1 accent-blue-600" />
                    <div>
                      <p className="text-sm font-medium">🤖 Monitoramento com IA</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {isAdmin || userPlan === "PAID"
                          ? "Detecção de quedas e intrusões, com alertas em tempo real."
                          : "Disponível apenas para planos pagantes. Atualize seu plano para ativar."}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
