import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const isAdmin = (session.user as any).role === "ADMIN";
    const userId = (session.user as any).id;

    const alerts = await prisma.alert.findMany({
      where: isAdmin ? undefined : { camera: { userId } },
      include: { camera: { select: { name: true } } },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar alertas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { cameraId, type, description } = body;
  if (!cameraId) {
    return NextResponse.json({ error: "cameraId obrigatório" }, { status: 400 });
  }
  try {
    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });

    const alert = await prisma.alert.create({
      data: {
        cameraId,
        type: type || "SUSPICIOUS_MOVEMENT",
        description: description || "Movimento suspeito detectado",
      },
    });
    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Erro ao criar alerta" }, { status: 500 });
  }
}
