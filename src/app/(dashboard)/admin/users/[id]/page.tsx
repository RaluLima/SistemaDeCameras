import prisma from "@/lib/prisma";
import { UserForm } from "@/components/UserForm";
import { PasswordActions } from "./PasswordActions";
import { BackButton } from "@/components/BackButton";
import { notFound } from "next/navigation";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { address: true },
  });
  if (!user) notFound();

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    nickname: user.nickname,
    phone: user.phone,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    address: user.address,
  };

  return (
    <div>
      <BackButton href="/admin/users" />
      <h1 className="text-3xl font-bold mb-6">Editar Usuário</h1>
      <UserForm user={safeUser} />
      <div className="mt-6">
        <PasswordActions user={safeUser} />
      </div>
    </div>
  );
}
