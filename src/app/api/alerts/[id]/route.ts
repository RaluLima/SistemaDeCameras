import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const processed = body.processed !== undefined ? !!body.processed : true;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { camera: { select: { userId: true } } },
    });
    if (!alert) {
      return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 });
    }
    if (auth.role !== 'ADMIN' && alert.camera.userId !== auth.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { processed },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Alert update error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
