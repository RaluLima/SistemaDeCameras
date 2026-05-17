import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const cameraIds = auth.role === 'ADMIN'
      ? (await prisma.camera.findMany({ select: { id: true } })).map(c => c.id)
      : (await prisma.camera.findMany({ where: { userId: auth.id }, select: { id: true } })).map(c => c.id);

    const [total, falls, movements] = await Promise.all([
      prisma.alert.count({ where: { cameraId: { in: cameraIds } } }),
      prisma.alert.count({ where: { cameraId: { in: cameraIds }, type: 'FALL_DETECTED' } }),
      prisma.alert.count({ where: { cameraId: { in: cameraIds }, type: 'SUSPICIOUS_MOVEMENT' } }),
    ]);

    return NextResponse.json({ total, fall_detected: falls, suspicious_movement: movements });
  } catch (err) {
    console.error('Alert count error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
