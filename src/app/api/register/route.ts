import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, email, nickname, phone, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nome, email e senha obrigatórios" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
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
        authProvider: "credentials",
      },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
