import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function AdminGroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  const groups = await prisma.cameraGroup.findMany({
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { cameras: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Grupos</h1>
        <Link href="/admin/groups/new">
          <Button>Novo Grupo</Button>
        </Link>
      </div>
      {/* Cards - Mobile */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">{group.name}</h3>
                <p className="text-sm text-gray-500">{group.owner.name}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{group._count.members} membro(s)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{group._count.cameras} câmera(s)</span>
              <Link href={`/admin/groups/${group.id}`}>
                <Button variant="outline" size="sm">Gerenciar</Button>
              </Link>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-8">Nenhum grupo ainda.</p>
        )}
      </div>

      {/* Table - Desktop */}
      <div className="bg-white rounded-lg shadow overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proprietário</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membros</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Câmeras</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{group.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{group.owner.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{group._count.members}</td>
                <td className="px-6 py-4 whitespace-nowrap">{group._count.cameras}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/admin/groups/${group.id}`}>
                    <Button variant="outline" size="sm">Gerenciar</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Nenhum grupo ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
