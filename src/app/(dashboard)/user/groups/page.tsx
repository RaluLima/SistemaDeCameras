import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function UserGroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id;

  const groups = await prisma.cameraGroup.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { cameras: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Meus Grupos</h1>
        <Link href="/user/groups/new">
          <Button>Novo Grupo</Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Link key={group.id} href={`/user/groups/${group.id}`} className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                Por {group.owner.name} &middot; {group._count.members} membro(s) &middot; {group._count.cameras} câmera(s)
              </p>
              <Button variant="outline" size="sm">Ver grupo</Button>
            </div>
          </Link>
        ))}
        {groups.length === 0 && (
          <p className="text-gray-500 col-span-full">Você não faz parte de nenhum grupo.</p>
        )}
      </div>
    </div>
  );
}
