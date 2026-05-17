import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const payload = await verifyToken(auth.slice(7));
    if (payload?.sub) return payload.sub as string;
  }
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: { camera: { select: { userId: true } } },
    });
    if (!recording) return NextResponse.json({ detail: 'Gravação não encontrada' }, { status: 404 });

    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (recording.camera.userId !== userId && role !== 'ADMIN') {
      return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
    }

    const filePath = recording.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ detail: 'Arquivo não encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="recording-${id}${ext}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('Recording file error:', err);
    return NextResponse.json({ detail: 'Erro interno' }, { status: 500 });
  }
}
