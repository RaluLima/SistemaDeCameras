import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    let email: string, password: string;

    const ct = req.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      email = (form.get('username') as string) || '';
      password = (form.get('password') as string) || '';
    } else {
      const body = await req.json();
      email = body.email || body.username || '';
      password = body.password || '';
    }

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email e senha obrigatórios' },
        { status: 422 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { nickname: email }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        password: true,
        role: true,
        plan: true,
        planExpiresAt: true,
        phone: true,
        mustChangePassword: true,
      },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { detail: 'Usuário não encontrado' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { detail: 'Senha incorreta' },
        { status: 401 }
      );
    }

    const accessToken = await signToken({
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        role: user.role,
        plan: user.plan,
        phone: user.phone,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error('Token error:', err);
    return NextResponse.json(
      { detail: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
