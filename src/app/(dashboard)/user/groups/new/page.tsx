"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/BackButton";

export default function NewUserGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          description: formData.get("description"),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Grupo criado!");
        router.push(`/user/groups/${json.id}`);
      } else {
        toast.error(json.error || "Erro ao criar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <BackButton href="/user/groups" />
      <h1 className="text-3xl font-bold mb-6">Novo Grupo</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome</label>
          <input type="text" name="name" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="Nome do grupo" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Descrição (opcional)</label>
          <textarea name="description" rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" placeholder="Descrição do grupo" />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar Grupo"}
        </Button>
      </form>
    </div>
  );
}
