import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const group = await prisma.cameraGroup.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
        cameras: { include: { user: { select: { name: true } } } },
      },
    });

    if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

    const isOwner = group.userId === auth.id;
    const isMember = group.members.some((m) => m.userId === auth.id);
    if (auth.role !== "ADMIN" && !isOwner && !isMember) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    return NextResponse.json(group);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { name, description } = await req.json();

    const group = await prisma.cameraGroup.findUnique({ where: { id: params.id } });
    if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

    if (auth.role !== "ADMIN" && group.userId !== auth.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const updated = await prisma.cameraGroup.update({
      where: { id: params.id },
      data: { ...(name && { name }), ...(description !== undefined && { description }) },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const group = await prisma.cameraGroup.findUnique({ where: { id: params.id } });
    if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

    if (auth.role !== "ADMIN" && group.userId !== auth.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    await prisma.cameraGroup.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Grupo removido" });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
