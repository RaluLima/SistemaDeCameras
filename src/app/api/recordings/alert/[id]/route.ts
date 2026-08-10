import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { retentionCutoff } from '@/lib/plan';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { camera: { select: { userId: true, retentionDays: true } } },
    });
    if (!alert) return NextResponse.json({ detail: 'Alerta não encontrado' }, { status: 404 });

    if (alert.camera.userId !== auth.id && auth.role !== 'ADMIN') {
      return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
    }

    const cutoff = retentionCutoff(alert.camera.retentionDays);
    const recordings = await prisma.recording.findMany({
      where: { alertId: id, createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(recordings);
  } catch (err) {
    console.error('Recordings by alert error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
