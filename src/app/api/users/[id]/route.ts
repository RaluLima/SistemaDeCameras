import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { name, email, nickname, phone, role, plan, planExpiresAt, street, number, complement, neighborhood, city, state, zipCode } = body;
  try {
    if (plan && plan !== "FREE" && plan !== "PAID") {
      return NextResponse.json({ message: "Plano inválido" }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        name, email, nickname, phone, role,
        ...(plan !== undefined && { plan }),
        ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
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
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Usuário removido" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover usuário" }, { status: 400 });
  }
}
