import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { hasAIAccess, isRetentionDaysValid } from "@/lib/plan";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id: params.id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    if (auth.role !== "ADMIN" && camera.userId !== auth.id)
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    const { name, type, streamUrl, status, groupId, retentionDays, recordingEnabled, aiMonitoringEnabled } = await req.json();
    if (retentionDays !== undefined && !isRetentionDaysValid(retentionDays)) {
      return NextResponse.json({ error: "Período de retenção inválido" }, { status: 400 });
    }
    if (aiMonitoringEnabled === true && camera.aiMonitoringEnabled !== true) {
      const owner = await prisma.user.findUnique({ where: { id: camera.userId }, select: { plan: true, planExpiresAt: true } });
      if (!owner || (auth.role !== "ADMIN" && !hasAIAccess(owner))) {
        return NextResponse.json({ error: "Monitoramento com IA disponível apenas para planos pagantes" }, { status: 403 });
      }
    }
    const updated = await prisma.camera.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(streamUrl !== undefined && { streamUrl: streamUrl || null }),
        ...(status !== undefined && { status }),
        ...(groupId !== undefined && { groupId: groupId || null }),
        ...(retentionDays !== undefined && { retentionDays }),
        ...(recordingEnabled !== undefined && { recordingEnabled }),
        ...(aiMonitoringEnabled !== undefined && { aiMonitoringEnabled }),
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
