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

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { token, platform } = await req.json();
    if (!token) {
      return NextResponse.json({ detail: 'Token obrigatório' }, { status: 422 });
    }

    await prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform: platform || 'expo', updatedAt: new Date() },
      create: { token, userId, platform: platform || 'expo' },
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Push register error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
