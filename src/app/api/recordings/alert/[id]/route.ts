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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { camera: { select: { userId: true } } },
    });
    if (!alert) return NextResponse.json({ detail: 'Alerta não encontrado' }, { status: 404 });

    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (alert.camera.userId !== userId && role !== 'ADMIN') {
      return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
    }

    const recordings = await prisma.recording.findMany({
      where: { alertId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(recordings);
  } catch (err) {
    console.error('Recordings by alert error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
