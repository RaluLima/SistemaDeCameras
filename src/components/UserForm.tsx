"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function UserForm({ user }: { user: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      nickname: formData.get("nickname"),
      phone: formData.get("phone"),
      role: formData.get("role"),
      street: formData.get("street"),
      number: formData.get("number"),
      complement: formData.get("complement"),
      neighborhood: formData.get("neighborhood"),
      city: formData.get("city"),
      state: formData.get("state"),
      zipCode: formData.get("zipCode"),
    };

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Usuário atualizado");
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao atualizar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label>Nome</label><input name="name" defaultValue={user.name} required className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Email</label><input type="email" name="email" defaultValue={user.email} required className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Telefone</label><input name="phone" defaultValue={user.phone || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Apelido</label><input name="nickname" defaultValue={user.nickname || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Tipo</label><select name="role" defaultValue={user.role} className="mt-1 block w-full rounded border-gray-300 shadow-sm"><option value="USER">Usuário</option><option value="ADMIN">Administrador</option></select></div>
        <div><label>Rua</label><input name="street" defaultValue={user.address?.street || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Número</label><input name="number" defaultValue={user.address?.number || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Complemento</label><input name="complement" defaultValue={user.address?.complement || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Bairro</label><input name="neighborhood" defaultValue={user.address?.neighborhood || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Cidade</label><input name="city" defaultValue={user.address?.city || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>Estado</label><input name="state" defaultValue={user.address?.state || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
        <div><label>CEP</label><input name="zipCode" defaultValue={user.address?.zipCode || ""} className="mt-1 block w-full rounded border-gray-300 shadow-sm" /></div>
      </div>
      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        {loading ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
