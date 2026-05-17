import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const cameraWhere = auth.role === 'ADMIN' ? {} : { userId: auth.id };

    const [totalCameras, alertsLast24h] = await Promise.all([
      prisma.camera.count({ where: cameraWhere }),
      prisma.alert.count({
        where: {
          camera: cameraWhere.userId ? { userId: auth.id } : undefined,
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalAlerts = await prisma.alert.count({
      where: { camera: auth.role === 'ADMIN' ? undefined : { userId: auth.id } },
    });

    return NextResponse.json({
      total_cameras: totalCameras,
      total_alerts: totalAlerts,
      alerts_last_24h: alertsLast24h,
      ai_enabled: 0,
    });
  } catch (err) {
    console.error('Camera stats error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
