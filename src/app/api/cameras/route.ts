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
    let cameras;
    if (role === "ADMIN") {
      cameras = await prisma.camera.findMany({ include: { user: { select: { name: true, email: true } } } });
    } else {
      cameras = await prisma.camera.findMany({ where: { userId } });
    }
    return NextResponse.json(cameras);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
