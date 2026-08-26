import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

const VALID_ROLES = ["ADMIN", "USER"];
const VALID_PLANS = ["FREE", "PAID"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, nickname, phone, role, plan, planExpiresAt, street, number, complement, neighborhood, city, state, zipCode } = body;

    if (plan && !VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
    }

    const hasAddressData = street || number || neighborhood || city || state || zipCode;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(nickname !== undefined && { nickname: nickname || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(role !== undefined && { role }),
        ...(plan !== undefined && { plan }),
        ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
        ...(hasAddressData && {
          address: {
            upsert: {
              create: { street, number, complement, neighborhood, city, state, zipCode, country: "Brasil" },
              update: { street, number, complement, neighborhood, city, state, zipCode },
            },
          },
        }),
      },
      select: {
        id: true, name: true, email: true, nickname: true, phone: true,
        role: true, plan: true, planExpiresAt: true, mustChangePassword: true,
        address: true,
      },
    });
    return NextResponse.json(user);
  } catch (err) {
    console.error("User update error:", err);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "Usuário removido" });
  } catch {
    return NextResponse.json({ error: "Erro ao remover usuário" }, { status: 400 });
  }
}
