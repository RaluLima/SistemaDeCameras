import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const cameras = role === "ADMIN"
      ? await prisma.camera.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } })
      : await prisma.camera.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(cameras);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const userId = (session.user as any).id;
    const { name, type, streamUrl, status, groupId } = await req.json();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    const camera = await prisma.camera.create({
      data: { name, type: type || "IP", streamUrl: streamUrl || null, status: status || "ACTIVE", userId, groupId: groupId || null },
    });
    return NextResponse.json(camera, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
