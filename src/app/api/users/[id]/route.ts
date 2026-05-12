import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { name, email, nickname, phone, role, street, number, complement, neighborhood, city, state, zipCode } = body;
  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        name, email, nickname, phone, role,
        address: {
          upsert: {
            create: { street, number, complement, neighborhood, city, state, zipCode },
            update: { street, number, complement, neighborhood, city, state, zipCode },
          },
        },
      },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ message: "Erro ao atualizar" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Usuário removido" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover usuário" }, { status: 400 });
  }
}
