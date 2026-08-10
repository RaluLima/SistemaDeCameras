import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { hasAIAccess, isRetentionDaysValid } from "@/lib/plan";
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
    const { name, type, streamUrl, status, groupId, retentionDays, recordingEnabled, aiMonitoringEnabled } = await req.json();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    if (retentionDays !== undefined && !isRetentionDaysValid(retentionDays)) {
      return NextResponse.json({ error: "Período de retenção inválido" }, { status: 400 });
    }
    if (aiMonitoringEnabled) {
      const user = await prisma.user.findUnique({ where: { id: auth.id }, select: { plan: true, planExpiresAt: true } });
      if (!user || (auth.role !== "ADMIN" && !hasAIAccess(user))) {
        return NextResponse.json({ error: "Monitoramento com IA disponível apenas para planos pagantes" }, { status: 403 });
      }
    }
    const camera = await prisma.camera.create({
      data: {
        name,
        type: type || "IP",
        streamUrl: streamUrl || null,
        status: status || "ACTIVE",
        retentionDays: retentionDays ?? 30,
        recordingEnabled: recordingEnabled ?? false,
        aiMonitoringEnabled: aiMonitoringEnabled ?? false,
        userId: auth.id,
        groupId: groupId || null,
      },
    });
    return NextResponse.json(camera, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
