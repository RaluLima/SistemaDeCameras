import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: { camera: { select: { userId: true } } },
    });
    if (!recording) return NextResponse.json({ detail: 'Gravação não encontrada' }, { status: 404 });

    if (recording.camera.userId !== auth.id && auth.role !== 'ADMIN') {
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
