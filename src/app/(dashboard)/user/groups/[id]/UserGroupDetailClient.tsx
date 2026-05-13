"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface Props {
  group: any;
  currentUserId: string;
  isOwner: boolean;
}

export function UserGroupDetailClient({ group, currentUserId, isOwner }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Membro adicionado!");
        setEmail("");
        router.refresh();
      } else {
        toast.error(json.error || "Erro ao adicionar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remover este membro?")) return;
    try {
      const res = await fetch(`/api/groups/${group.id}/members?memberId=${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Membro removido");
        router.refresh();
      } else {
        const json = await res.json();
        toast.error(json.error || "Erro ao remover");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        toast.success("Grupo atualizado");
        router.refresh();
      } else {
        const json = await res.json();
        toast.error(json.error || "Erro ao atualizar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este grupo permanentemente?")) return;
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Grupo excluído");
        router.push("/user/groups");
      } else {
        const json = await res.json();
        toast.error(json.error || "Erro ao excluir");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isOwner && (
          <Card>
            <CardHeader><CardTitle>Informações do Grupo</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-dark-200 dark:text-gray-100 px-3 py-2 shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-dark-200 dark:text-gray-100 px-3 py-2 shadow-sm" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="submit" disabled={updating}>
                    {updating ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDelete} className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20">
                    Excluir Grupo
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Proprietário</CardTitle></CardHeader>
          <CardContent>
            <p className="font-medium">{group.owner.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{group.owner.email}</p>
          </CardContent>
        </Card>
      </div>

      {isOwner && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Membros ({group.members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email do usuário cadastrado..."
                required
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-dark-200 dark:text-gray-100 px-3 py-2 shadow-sm"
              />
              <Button type="submit" disabled={adding}>
                {adding ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Apenas usuários já cadastrados no sistema podem ser adicionados.
            </p>
            <div className="space-y-2">
              {group.members.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-200 rounded-md">
                  <div>
                    <p className="font-medium dark:text-gray-100">{member.user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${member.role === "OWNER" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"}`}>
                      {member.role}
                    </span>
                    {member.role !== "OWNER" && (
                      <button onClick={() => handleRemoveMember(member.id)} className="text-red-500 hover:text-red-700 text-sm">
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {group.members.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum membro no grupo.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!isOwner && (
        <Card>
          <CardHeader><CardTitle>Membros ({group.members.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.members.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-200 rounded-md">
                  <div>
                    <p className="font-medium dark:text-gray-100">{member.user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.user.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${member.role === "OWNER" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"}`}>
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {group.cameras.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Câmeras do Grupo ({group.cameras.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.cameras.map((cam: any) => (
                <div key={cam.id} className="bg-gray-50 dark:bg-dark-200 rounded-lg p-4">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-md mb-2 flex items-center justify-center text-gray-400 dark:text-gray-500">
                    📷 Preview
                  </div>
                  <p className="font-medium dark:text-gray-100">{cam.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Proprietário: {cam.user.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{cam.streamUrl || "N/A"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
