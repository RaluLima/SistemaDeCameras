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
  plan: string;
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
      plan: formData.get("plan") || "FREE",
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Usuários</h1>
        <button onClick={() => { setTempPassword(null); setShowAddModal(true); }} className="btn-primary whitespace-nowrap">
          + Novo Usuário
        </button>
      </div>

      {/* Cards - Mobile */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="card p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${user.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>
                {user.role}
              </span>
              {user.plan === "PAID" && (
                <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                  Pagante
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Tel: {user.phone || "-"}</p>
            <div className="flex gap-3 text-sm border-t border-gray-200 dark:border-gray-700 pt-3">
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
      <div className="card overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{user.phone || "-"}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${user.role === "ADMIN" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300" : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"}`}>
                    {user.role}
                  </span>
                  {user.plan === "PAID" && (
                    <span className="ml-1 px-2 py-1 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      Pagante
                    </span>
                  )}
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
              <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Novo Usuário</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                <input type="text" name="name" required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input type="email" name="email" required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apelido (opcional)</label>
                <input type="text" name="nickname" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</label>
                <input type="tel" name="phone" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha temporária</label>
                <input type="password" name="password" required minLength={6} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                <select name="role" className="input-field">
                  <option value="USER">Usuário</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Plano</label>
                <select name="plan" defaultValue="FREE" className="input-field">
                  <option value="FREE">Gratuito</option>
                  <option value="PAID">Pagante</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" disabled={addLoading} className="btn-primary">
                  {addLoading ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(null)}>
          <div className="modal-content max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Gerar nova senha</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Uma nova senha temporária será gerada para <strong className="text-gray-900 dark:text-gray-100">{showPasswordModal.name}</strong>.
              O usuário será obrigado a trocar a senha no próximo login.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowPasswordModal(null)} className="btn-outline">Cancelar</button>
              <button onClick={() => handleGeneratePassword(showPasswordModal.id)} disabled={genLoading} className="btn-primary !bg-yellow-600 hover:!bg-yellow-700">
                {genLoading ? "Gerando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="modal-overlay" onClick={() => setTempPassword(null)}>
          <div className="modal-content max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Senha Temporária</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">Compartilhe esta senha com o usuário:</p>
            <div className="text-2xl font-mono font-bold bg-gray-100 dark:bg-dark-200 p-4 rounded mb-4 select-all text-gray-900 dark:text-gray-100">
              {tempPassword}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">O usuário será obrigado a trocar a senha no próximo login.</p>
            <button onClick={() => { setTempPassword(null); router.refresh(); }} className="btn-primary">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
