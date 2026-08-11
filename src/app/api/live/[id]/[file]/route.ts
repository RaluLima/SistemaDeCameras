import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { id, file } = await params;

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, streamUrl: true },
    });
    if (!camera) {
      return NextResponse.json({ detail: 'Câmera não encontrada' }, { status: 404 });
    }
    if (auth.role !== 'ADMIN' && camera.userId !== auth.id) {
      return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
    }

    const base = process.env.LIVE_BASE_URL?.replace(/\/+$/, '');
    if (!base) {
      return NextResponse.json(
        { detail: 'Servidor de mídia (HLS) não configurado. Defina LIVE_BASE_URL.' },
        { status: 503 }
      );
    }
    if (!camera.streamUrl) {
      return NextResponse.json({ detail: 'Câmera sem URL de stream' }, { status: 400 });
    }

    const search = req.nextUrl.search || '';
    const target = `${base}/${encodeURIComponent(id)}/${file}${search}`;

    const upstream = await fetch(target, {
      headers: { accept: '*/*' },
      signal: AbortSignal.timeout(15000),
    });

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);

    return new NextResponse(upstream.body as any, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error('Live proxy error:', err);
    return NextResponse.json(
      { detail: 'Não foi possível obter o stream da câmera' },
      { status: 502 }
    );
  }
}
