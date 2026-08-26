import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { hasRecorderAccess } from '@/lib/service-auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    const isRecorder = hasRecorderAccess(req);
    if (!isRecorder && auth?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const cameras = await prisma.camera.findMany({
      where: {
        recordingEnabled: true,
        streamUrl: { not: null },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        streamUrl: true,
        retentionDays: true,
        aiMonitoringEnabled: true,
        userId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(cameras);
  } catch (err) {
    console.error('Recording jobs error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
