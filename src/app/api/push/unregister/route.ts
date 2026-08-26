import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token') || '';

    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 422 });
    }

    await prisma.pushToken.deleteMany({ where: { token, userId: auth.id } });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Push unregister error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
