import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { hasAIAccess, isRetentionDaysValid } from "@/lib/plan";
import prisma from "@/lib/prisma";

const VALID_CAMERA_TYPES = ["IP", "USB", "ANALOG", "WIRELESS", "OTHER"];
const VALID_STATUSES = ["ACTIVE", "INACTIVE", "ERROR"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    if (auth.role !== "ADMIN" && camera.userId !== auth.id)
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    const { name, type, streamUrl, status, groupId, retentionDays, recordingEnabled, aiMonitoringEnabled, userId } = await req.json();
    if (userId && auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem atribuir câmeras a outros usuários" }, { status: 403 });
    }
    if (userId) {
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (type && !VALID_CAMERA_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de câmera inválido" }, { status: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }
    if (retentionDays !== undefined && !isRetentionDaysValid(retentionDays)) {
      return NextResponse.json({ error: "Período de retenção inválido" }, { status: 400 });
    }
    const targetUserId = userId || camera.userId;
    if (aiMonitoringEnabled === true && camera.aiMonitoringEnabled !== true) {
      const owner = await prisma.user.findUnique({ where: { id: targetUserId }, select: { plan: true, planExpiresAt: true } });
      if (!owner || (auth.role !== "ADMIN" && !hasAIAccess(owner))) {
        return NextResponse.json({ error: "Monitoramento com IA disponível apenas para planos pagantes" }, { status: 403 });
      }
    }
    const updated = await prisma.camera.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(streamUrl !== undefined && { streamUrl: streamUrl || null }),
        ...(status !== undefined && { status }),
        ...(groupId !== undefined && { groupId: groupId || null }),
        ...(retentionDays !== undefined && { retentionDays }),
        ...(recordingEnabled !== undefined && { recordingEnabled }),
        ...(aiMonitoringEnabled !== undefined && { aiMonitoringEnabled }),
        ...(userId !== undefined && auth.role === "ADMIN" && { userId }),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const camera = await prisma.camera.findUnique({ where: { id } });
    if (!camera) return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
    if (auth.role !== "ADMIN" && camera.userId !== auth.id)
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
    await prisma.camera.delete({ where: { id } });
    return NextResponse.json({ message: "Câmera removida" });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
