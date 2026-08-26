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

    const [total, falls, movements] = await Promise.all([
      prisma.alert.count({ where: { camera: cameraWhere } }),
      prisma.alert.count({ where: { camera: cameraWhere, type: 'FALL_DETECTED' } }),
      prisma.alert.count({ where: { camera: cameraWhere, type: 'SUSPICIOUS_MOVEMENT' } }),
    ]);

    return NextResponse.json({ total, fall_detected: falls, suspicious_movement: movements });
  } catch (err) {
    console.error('Alert count error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
