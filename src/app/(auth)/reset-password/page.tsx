"use client";
import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      toast.error("Token inválido");
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password");

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (res.ok) {
        setDone(true);
        toast.success("Senha alterada com sucesso!");
      } else {
        toast.error(json.error || "Erro ao redefinir senha");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Link inválido</h1>
        <p className="text-gray-600 mb-6">Token de recuperação não encontrado.</p>
        <Link href="/forgot-password" className="text-blue-600 hover:underline">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Senha alterada!</h1>
        <p className="text-gray-600 mb-6">Sua senha foi redefinida com sucesso.</p>
        <Link href="/login" className="text-blue-600 hover:underline">
          Fazer login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
      <h1 className="text-2xl font-bold text-center mb-6">Nova Senha</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nova senha</label>
          <input type="password" name="password" required minLength={6} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="Mínimo 6 caracteres" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Alterando..." : "Redefinir senha"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-800">
      <Suspense fallback={<div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">Carregando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
