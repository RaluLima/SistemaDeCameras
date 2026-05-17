import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id: params.id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    if (auth.role !== "ADMIN" && camera.userId !== auth.id)
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
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id: params.id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    if (auth.role !== "ADMIN" && camera.userId !== auth.id)
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    await prisma.camera.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Câmera removida" });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
