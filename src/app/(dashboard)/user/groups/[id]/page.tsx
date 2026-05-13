import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { UserGroupDetailClient } from "./UserGroupDetailClient";

export default async function UserGroupDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role;

  const group = await prisma.cameraGroup.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      cameras: { include: { user: { select: { name: true } } } },
    },
  });

  if (!group) notFound();

  const isOwner = group.userId === userId;
  const isMember = group.members.some((m) => m.userId === userId);
  if (role !== "ADMIN" && !isOwner && !isMember) {
    redirect("/user/groups");
  }

  const safeGroup = {
    id: group.id,
    name: group.name,
    description: group.description,
    userId: group.userId,
    owner: group.owner,
    cameras: group.cameras,
    members: group.members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
    })),
  };

  return (
    <div>
      <BackButton href="/user/groups" />
      <h1 className="text-3xl font-bold mb-6 dark:text-gray-100">{group.name}</h1>
      <UserGroupDetailClient group={safeGroup} currentUserId={userId} isOwner={isOwner} />
    </div>
  );
}
