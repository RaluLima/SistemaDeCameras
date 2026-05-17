import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const cameras = auth.role === "ADMIN"
      ? await prisma.camera.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } })
      : await prisma.camera.findMany({ where: { userId: auth.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(cameras);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { name, type, streamUrl, status, groupId } = await req.json();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    const camera = await prisma.camera.create({
      data: { name, type: type || "IP", streamUrl: streamUrl || null, status: status || "ACTIVE", userId: auth.id, groupId: groupId || null },
    });
    return NextResponse.json(camera, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
