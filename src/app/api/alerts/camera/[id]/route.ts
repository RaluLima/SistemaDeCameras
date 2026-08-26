import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const limit = isNaN(rawLimit) ? 50 : Math.min(rawLimit, 200);

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!camera) {
      return NextResponse.json({ error: 'Câmera não encontrada' }, { status: 404 });
    }

    if (camera.userId !== auth.id && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const alerts = await prisma.alert.findMany({
      where: { cameraId: id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json(alerts);
  } catch (err) {
    console.error('Alerts by camera error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
