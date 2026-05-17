import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ detail: 'Token obrigatório' }, { status: 422 });
    }

    await prisma.pushToken.deleteMany({ where: { token, userId: auth.id } });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Push unregister error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
