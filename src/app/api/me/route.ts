import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

async function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const payload = await verifyToken(auth.slice(7));
    if (payload?.sub) {
      return prisma.user.findUnique({
        where: { id: payload.sub as string },
        select: { id: true, email: true, name: true, nickname: true, role: true, phone: true, mustChangePassword: true },
      });
    }
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    const id = (session.user as any).id;
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, nickname: true, role: true, phone: true, mustChangePassword: true },
    });
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (err) {
    console.error('Me error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
