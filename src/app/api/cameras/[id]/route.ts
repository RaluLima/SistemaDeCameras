import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id: params.id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    if (role !== "ADMIN" && camera.userId !== userId)
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    const { name, type, streamUrl, status, groupId } = await req.json();
    const updated = await prisma.camera.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(streamUrl !== undefined && { streamUrl: streamUrl || null }),
        ...(status !== undefined && { status }),
        ...(groupId !== undefined && { groupId: groupId || null }),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id: params.id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    if (role !== "ADMIN" && camera.userId !== userId)
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    await prisma.camera.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Câmera removida" });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
