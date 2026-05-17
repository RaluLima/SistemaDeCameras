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
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const camera = await prisma.camera.findUnique({ where: { id }, select: { userId: true } });
    if (!camera) return NextResponse.json({ detail: 'Câmera não encontrada' }, { status: 404 });

    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (camera.userId !== userId && role !== 'ADMIN') {
      return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
    }

    const recordings = await prisma.recording.findMany({
      where: { cameraId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(recordings);
  } catch (err) {
    console.error('Recordings by camera error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
