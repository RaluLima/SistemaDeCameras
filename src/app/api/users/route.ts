import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const users = await prisma.user.findMany({ include: { address: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { name, email, nickname, phone, password, role, plan, planExpiresAt } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nome, email e senha obrigatórios" }, { status: 400 });
    }

    if (plan && plan !== "FREE" && plan !== "PAID") {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 });
    }

    if (nickname) {
      const existingNick = await prisma.user.findUnique({ where: { nickname } });
      if (existingNick) {
        return NextResponse.json({ error: "Apelido já está em uso" }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        nickname: nickname || null,
        phone: phone || null,
        password: hashedPassword,
        role: role || "USER",
        plan: plan || "FREE",
        planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null,
        authProvider: "credentials",
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
