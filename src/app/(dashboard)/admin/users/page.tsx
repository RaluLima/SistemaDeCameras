"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  mustChangePassword: boolean;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<{ id: string; name: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      nickname: formData.get("nickname"),
      phone: formData.get("phone"),
      password: formData.get("password"),
      role: formData.get("role"),
    };
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Usuário criado com senha temporária");
        setShowAddModal(false);
        fetchUsers();
      } else {
        toast.error(json.error || "Erro ao criar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover usuário "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Usuário removido");
        fetchUsers();
      } else {
        const json = await res.json();
        toast.error(json.error || "Erro ao remover");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  async function handleGeneratePassword(id: string) {
    setGenLoading(true);
    setShowPasswordModal(null);
    try {
      const res = await fetch(`/api/users/${id}/password`, { method: "POST" });
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
      setGenLoading(false);
    }
  }

  if (loading) return <div className="text-center py-8">Carregando...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Usuários</h1>
        <button onClick={() => { setTempPassword(null); setShowAddModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm whitespace-nowrap">
          + Novo Usuário
        </button>
      </div>

      {/* Cards - Mobile */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold">{user.name}</h3>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${user.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>
                {user.role}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">Tel: {user.phone || "-"}</p>
            <div className="flex gap-3 text-sm border-t pt-3">
              <Link href={`/admin/users/${user.id}`} className="text-blue-600 hover:underline">Editar</Link>
              <button onClick={() => setShowPasswordModal({ id: user.id, name: user.name })} className="text-yellow-600 hover:underline">Nova Senha</button>
              <button onClick={() => handleDelete(user.id, user.name)} className="text-red-600 hover:underline">Remover</button>
            </div>
          </div>
        ))}
        {users.length === 0 && !loading && (
          <p className="text-gray-500 col-span-full text-center py-8">Nenhum usuário encontrado.</p>
        )}
      </div>

      {/* Table - Desktop */}
      <div className="bg-white rounded-lg shadow overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{user.phone || "-"}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${user.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  <Link href={`/admin/users/${user.id}`} className="text-blue-600 hover:underline text-sm">Editar</Link>
                  <button onClick={() => setShowPasswordModal({ id: user.id, name: user.name })} className="text-yellow-600 hover:underline text-sm">Nova Senha</button>
                  <button onClick={() => handleDelete(user.id, user.name)} className="text-red-600 hover:underline text-sm">Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Novo Usuário</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input type="text" name="name" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" name="email" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apelido (opcional)</label>
                <input type="text" name="nickname" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefone</label>
                <input type="tel" name="phone" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Senha temporária</label>
                <input type="password" name="password" required minLength={6} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo</label>
                <select name="role" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm">
                  <option value="USER">Usuário</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={addLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {addLoading ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPasswordModal(null)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">Gerar nova senha</h2>
            <p className="text-gray-600 mb-6">
              Uma nova senha temporária será gerada para <strong>{showPasswordModal.name}</strong>.
              O usuário será obrigado a trocar a senha no próximo login.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowPasswordModal(null)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleGeneratePassword(showPasswordModal.id)} disabled={genLoading} className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50">
                {genLoading ? "Gerando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setTempPassword(null)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">Senha Temporária</h2>
            <p className="text-gray-600 mb-2">Compartilhe esta senha com o usuário:</p>
            <div className="text-2xl font-mono font-bold bg-gray-100 p-4 rounded mb-4 select-all">
              {tempPassword}
            </div>
            <p className="text-sm text-gray-500 mb-4">O usuário será obrigado a trocar a senha no próximo login.</p>
            <button onClick={() => { setTempPassword(null); router.refresh(); }} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
