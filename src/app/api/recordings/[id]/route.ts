import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { retentionCutoff } from '@/lib/plan';
import { deleteRecordingFile } from '@/lib/recording-file';
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: { camera: { select: { userId: true, retentionDays: true } } },
    });
    if (!recording) return NextResponse.json({ error: 'Gravação não encontrada' }, { status: 404 });

    if (recording.camera.userId !== auth.id && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (recording.createdAt < retentionCutoff(recording.camera.retentionDays)) {
      return NextResponse.json({ error: 'Gravação fora do período de retenção' }, { status: 410 });
    }

    return NextResponse.json(recording);
  } catch (err) {
    console.error('Recording fetch error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: { camera: { select: { userId: true } } },
    });
    if (!recording) return NextResponse.json({ error: 'Gravação não encontrada' }, { status: 404 });

    if (recording.camera.userId !== auth.id && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    await prisma.recording.delete({ where: { id } });
    const fileRemoved = deleteRecordingFile(recording.filePath);

    return NextResponse.json({ message: 'Gravação removida', fileRemoved });
  } catch (err) {
    console.error('Recording delete error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
