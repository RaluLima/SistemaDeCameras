"use client";
import { useState } from "react";
import toast from "react-hot-toast";

export function PasswordActions({ user }: { user: { id: string; name: string; mustChangePassword: boolean } }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setShowConfirm(false);
    try {
      const res = await fetch(`/api/users/${user.id}/password`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setTempPassword(json.tempPassword);
        toast.success("Senha temporária gerada");
      } else {
        toast.error(json.error || "Erro ao gerar senha");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
      <h2 className="text-lg font-semibold mb-2">Senha</h2>
      <p className="text-gray-600 text-sm mb-4">
        {user.mustChangePassword
          ? "Este usuário está com senha temporária e precisa trocá-la no próximo login."
          : "Gere uma nova senha temporária. O usuário será obrigado a trocá-la no próximo login."}
      </p>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50"
      >
        {loading ? "Gerando..." : "Gerar Nova Senha Temporária"}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Confirmar</h3>
            <p className="text-gray-600 mb-6">
              Uma nova senha temporária será gerada para <strong>{user.name}</strong>.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Cancelar</button>
              <button onClick={handleGenerate} className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setTempPassword(null)}>
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Senha Temporária</h3>
            <div className="text-2xl font-mono font-bold bg-gray-100 p-4 rounded mb-4 select-all">{tempPassword}</div>
            <p className="text-sm text-gray-500 mb-4">Compartilhe com o usuário.</p>
            <button onClick={() => setTempPassword(null)} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
