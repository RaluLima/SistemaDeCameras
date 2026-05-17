import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { token, platform } = await req.json();
    if (!token) {
      return NextResponse.json({ detail: 'Token obrigatório' }, { status: 422 });
    }

    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: auth.id, platform: platform || 'expo', updatedAt: new Date() },
      create: { token, userId: auth.id, platform: platform || 'expo' },
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Push register error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
