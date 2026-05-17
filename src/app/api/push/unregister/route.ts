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

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ detail: 'Token obrigatório' }, { status: 422 });
    }

    await prisma.pushToken.deleteMany({ where: { token, userId } });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Push unregister error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
