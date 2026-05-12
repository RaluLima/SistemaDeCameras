"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      nickname: formData.get("nickname"),
      phone: formData.get("phone"),
      password: formData.get("password"),
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        setStep("success");
        toast.success("Cadastro realizado! Faça login.");
      } else {
        toast.error(json.error || "Erro ao cadastrar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-800">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold mb-4">Cadastro realizado!</h1>
          <p className="text-gray-600 mb-6">
            Sua conta foi criada. Agora você pode fazer login.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-800">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Criar Conta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input type="text" name="name" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="Seu nome" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Apelido (opcional - use para login)</label>
            <input type="text" name="nickname" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="meu-apelido" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone (opcional)</label>
            <input type="tel" name="phone" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input type="password" name="password" required minLength={6} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}
