import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const payload = await verifyToken(auth.slice(7));
    if (payload?.sub) return payload.sub as string;
  }
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id || null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as any)?.role === 'ADMIN';

    const cameraIds = isAdmin
      ? (await prisma.camera.findMany({ select: { id: true } })).map(c => c.id)
      : (await prisma.camera.findMany({ where: { userId }, select: { id: true } })).map(c => c.id);

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
