import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const cameraWhere = auth.role === 'ADMIN' ? {} : { userId: auth.id };
    const alertWhere = auth.role === 'ADMIN' ? {} : { camera: { userId: auth.id } };

    const [totalCameras, totalAlerts, alertsLast24h, aiEnabled] = await Promise.all([
      prisma.camera.count({ where: cameraWhere }),
      prisma.alert.count({ where: alertWhere }),
      prisma.alert.count({
        where: {
          ...alertWhere,
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.camera.count({ where: { ...cameraWhere, aiMonitoringEnabled: true } }),
    ]);

    return NextResponse.json({
      total_cameras: totalCameras,
      total_alerts: totalAlerts,
      alerts_last_24h: alertsLast24h,
      ai_enabled: aiEnabled,
    });
  } catch (err) {
    console.error('Camera stats error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
