"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");

  async function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/" });
  }

  async function handlePhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    if (phoneStep === "phone") {
      setPhone(formData.get("phone") as string);
      setPhoneStep("code");
      setLoading(false);
      return;
    }

    const result = await signIn("phone", {
      phone,
      code: formData.get("code") as string,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
      setPhoneStep("phone");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-800">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-0">
        <h1 className="text-2xl font-bold text-center mb-6">Camera Monitor</h1>

        <form onSubmit={handleCredentials} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email ou Apelido</label>
            <input type="text" name="email" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="seu@email.com ou apelido" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input type="password" name="password" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Esqueceu a senha?
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <hr className="flex-1" />
          <span className="text-sm text-gray-400">ou</span>
          <hr className="flex-1" />
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
