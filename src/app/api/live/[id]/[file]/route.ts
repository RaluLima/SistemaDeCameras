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
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, file } = await params;

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, streamUrl: true },
    });
    if (!camera) {
      return NextResponse.json({ error: 'Câmera não encontrada' }, { status: 404 });
    }
    if (auth.role !== 'ADMIN' && camera.userId !== auth.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const base = process.env.LIVE_BASE_URL?.replace(/\/+$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'Servidor de mídia (HLS) não configurado. Defina LIVE_BASE_URL.' },
        { status: 503 }
      );
    }
    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'Câmera sem URL de stream' }, { status: 400 });
    }

    const safeFile = file.replace(/[^a-zA-Z0-9._/-]/g, '');
    if (safeFile.includes('..')) {
      return NextResponse.json({ error: 'Caminho invalido' }, { status: 400 });
    }
    const search = req.nextUrl.search || '';
    let streamPath: string;
    try {
      const url = new URL(camera.streamUrl);
      streamPath = url.pathname.replace(/^\/+/, '');
    } catch {
      streamPath = encodeURIComponent(id);
    }
    const target = `${base}/${streamPath}/${safeFile}${search}`;

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
      { error: 'Não foi possível obter o stream da câmera' },
      { status: 502 }
    );
  }
}
