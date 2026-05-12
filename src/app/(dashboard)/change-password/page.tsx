"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    if (newPassword.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (res.ok) {
        await update({ mustChangePassword: false });
        toast.success("Senha alterada com sucesso!");
        router.push("/admin");
      } else {
        toast.error(json.error || "Erro ao alterar senha");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-2">Alterar Senha</h1>
        <p className="text-gray-600 mb-6">
          Você está usando uma senha temporária. Defina uma nova senha.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha atual</label>
            <input type="password" name="currentPassword" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nova senha</label>
            <input type="password" name="newPassword" required minLength={6} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
