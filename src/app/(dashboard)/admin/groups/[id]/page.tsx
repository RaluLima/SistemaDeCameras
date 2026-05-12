import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { GroupDetailClient } from "./GroupDetailClient";

export default async function AdminGroupDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  const group = await prisma.cameraGroup.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      cameras: { include: { user: { select: { name: true } } } },
    },
  });

  if (!group) notFound();

  return (
    <div>
      <BackButton href="/admin/groups" />
      <h1 className="text-3xl font-bold mb-6">{group.name}</h1>
      <GroupDetailClient group={group} />
    </div>
  );
}
