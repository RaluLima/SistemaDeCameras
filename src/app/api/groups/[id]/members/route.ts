import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userId = (session.user as any).id;
    const role = (session.user as any).role;
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });
    }

    const group = await prisma.cameraGroup.findUnique({ where: { id: params.id } });
    if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

    if (role !== "ADMIN" && group.userId !== userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: params.id, userId: userToAdd.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "Usuário já é membro deste grupo" }, { status: 400 });
    }

    const member = await prisma.groupMember.create({
      data: { groupId: params.id, userId: userToAdd.id, role: "MEMBER" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(member, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userId = (session.user as any).id;
    const role = (session.user as any).role;
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId obrigatório" }, { status: 400 });
    }

    const group = await prisma.cameraGroup.findUnique({ where: { id: params.id } });
    if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

    if (role !== "ADMIN" && group.userId !== userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Não é possível remover o proprietário" }, { status: 400 });
    }

    await prisma.groupMember.delete({ where: { id: memberId } });
    return NextResponse.json({ message: "Membro removido" });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
