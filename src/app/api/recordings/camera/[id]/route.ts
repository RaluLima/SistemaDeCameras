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
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const camera = await prisma.camera.findUnique({ where: { id }, select: { userId: true, retentionDays: true } });
    if (!camera) return NextResponse.json({ detail: 'Câmera não encontrada' }, { status: 404 });

    if (camera.userId !== auth.id && auth.role !== 'ADMIN') {
      return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
    }

    const cutoff = retentionCutoff(camera.retentionDays);
    await prisma.recording.deleteMany({
      where: { cameraId: id, createdAt: { lt: cutoff } },
    });

    const recordings = await prisma.recording.findMany({
      where: { cameraId: id, createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(recordings);
  } catch (err) {
    console.error('Recordings by camera error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
