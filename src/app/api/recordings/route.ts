import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { hasRecorderAccess } from '@/lib/service-auth';
import { retentionCutoff } from '@/lib/plan';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cameraId = searchParams.get('cameraId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    const recordings = await prisma.recording.findMany({
      where: {
        ...(cameraId ? { cameraId } : {}),
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
      if (auth.role !== 'ADMIN' && r.camera.userId !== auth.id) return false;
      return r.createdAt >= retentionCutoff(r.camera.retentionDays);
    });

    return NextResponse.json(filtered);
  } catch (err) {
    console.error('Recordings list error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    const isRecorder = hasRecorderAccess(req);
    if (!auth && !isRecorder) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { cameraId, filePath, duration, size, alertId, startedAt } = body;
    if (!cameraId) {
      return NextResponse.json({ detail: 'cameraId obrigatório' }, { status: 400 });
    }
    if (!filePath) {
      return NextResponse.json({ detail: 'filePath obrigatório' }, { status: 400 });
    }

    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      select: { id: true, userId: true, recordingEnabled: true },
    });
    if (!camera) {
      return NextResponse.json({ detail: 'Câmera não encontrada' }, { status: 404 });
    }

    if (!isRecorder) {
      if (auth?.role !== 'ADMIN' && camera.userId !== auth?.id) {
        return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
      }
      if (auth?.role !== 'ADMIN' && !camera.recordingEnabled) {
        return NextResponse.json(
          { detail: 'Gravação desativada para esta câmera' },
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
        return NextResponse.json({ detail: 'Alerta inválido para esta câmera' }, { status: 400 });
      }
    }

    const createdAt = startedAt ? new Date(startedAt) : new Date();
    if (isNaN(createdAt.getTime())) {
      return NextResponse.json({ detail: 'startedAt inválido' }, { status: 400 });
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
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
