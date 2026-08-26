import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { retentionCutoff } from '@/lib/plan';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cameraId = searchParams.get('cameraId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const rawOffset = parseInt(searchParams.get('offset') || '0');
    const limit = isNaN(rawLimit) ? 50 : Math.min(rawLimit, 200);
    const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    const cameraFilter = auth.role === 'ADMIN'
      ? (cameraId ? { cameraId } : {})
      : { camera: { userId: auth.id, ...(cameraId ? { id: cameraId } : {}) } };

    const recordings = await prisma.recording.findMany({
      where: {
        ...cameraFilter,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        camera: {
          select: { name: true, retentionDays: true, userId: true, streamUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const filtered = recordings.filter((r) => {
      return r.createdAt >= retentionCutoff(r.camera.retentionDays);
    });

    return NextResponse.json(filtered);
  } catch (err) {
    console.error('Recordings list error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    const { hasRecorderAccess } = await import('@/lib/service-auth');
    const isRecorder = hasRecorderAccess(req);
    if (!auth && !isRecorder) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { cameraId, filePath, duration, size, alertId, startedAt } = body;
    if (!cameraId) {
      return NextResponse.json({ error: 'cameraId obrigatório' }, { status: 400 });
    }
    if (!filePath) {
      return NextResponse.json({ error: 'filePath obrigatório' }, { status: 400 });
    }

    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      select: { id: true, userId: true, recordingEnabled: true },
    });
    if (!camera) {
      return NextResponse.json({ error: 'Câmera não encontrada' }, { status: 404 });
    }

    if (!isRecorder) {
      if (auth?.role !== 'ADMIN' && camera.userId !== auth?.id) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      if (auth?.role !== 'ADMIN' && !camera.recordingEnabled) {
        return NextResponse.json(
          { error: 'Gravação desativada para esta câmera' },
          { status: 403 }
        );
      }
    }

    if (alertId) {
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        select: { cameraId: true },
      });
      if (!alert || alert.cameraId !== cameraId) {
        return NextResponse.json({ error: 'Alerta inválido para esta câmera' }, { status: 400 });
      }
    }

    const createdAt = startedAt ? new Date(startedAt) : new Date();
    if (isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: 'startedAt inválido' }, { status: 400 });
    }

    const recording = await prisma.recording.create({
      data: {
        cameraId,
        alertId: alertId || null,
        filePath,
        duration: duration || 0,
        size: size || 0,
        createdAt,
      },
    });

    return NextResponse.json(recording, { status: 201 });
  } catch (err) {
    console.error('Recording create error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
