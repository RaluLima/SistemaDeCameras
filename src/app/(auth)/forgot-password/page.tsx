"use client";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      const json = await res.json();
      if (res.ok) {
        setSent(true);
        toast.success("Email de recuperação enviado!");
      } else {
        toast.error(json.error || "Erro ao solicitar recuperação");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-800">
        <div className="bg-white dark:bg-dark-100 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-0 text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold mb-4 dark:text-gray-100">Email enviado!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enviamos um link de recuperação para seu email. Verifique sua caixa de entrada.
          </p>
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-800">
      <div className="bg-white dark:bg-dark-100 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-0">
        <h1 className="text-2xl font-bold text-center mb-2 dark:text-gray-100">Recuperar Senha</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Digite seu email para receber um link de recuperação.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" name="email" required className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-dark-200 dark:text-gray-100 px-3 py-2 shadow-sm" placeholder="seu@email.com" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Lembrou a senha?{" "}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
            Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}
