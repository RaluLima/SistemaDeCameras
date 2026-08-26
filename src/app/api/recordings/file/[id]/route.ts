import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { retentionCutoff } from '@/lib/plan';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.ts': 'video/mp2t',
  '.avi': 'video/x-msvideo',
};

function isPathSafe(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const recordingsDir = path.resolve(process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings'));
  return resolved.startsWith(recordingsDir);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: { camera: { select: { userId: true, retentionDays: true, name: true } } },
    });
    if (!recording) return NextResponse.json({ error: 'Gravação não encontrada' }, { status: 404 });

    if (recording.camera.userId !== auth.id && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (recording.createdAt < retentionCutoff(recording.camera.retentionDays)) {
      return NextResponse.json({ error: 'Gravação fora do período de retenção' }, { status: 410 });
    }

    const { searchParams } = new URL(req.url);
    const asDownload = searchParams.get('download') === '1';

    const filePath = recording.filePath;
    if (!filePath) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });

    if (/^https?:\/\//i.test(filePath)) {
      return NextResponse.redirect(filePath);
    }

    if (!isPathSafe(filePath)) {
      return NextResponse.json({ error: 'Caminho de arquivo inválido' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const fileName = encodeURIComponent(`recording-${id}${ext}`);
    const disposition = asDownload ? 'attachment' : 'inline';
    const headers: Record<string, string> = {
      'Content-Type': mime,
      'Content-Disposition': `${disposition}; filename="${fileName}"`,
      'Accept-Ranges': 'bytes',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (start >= 0 && end >= start && start < stat.size) {
          const chunk = Readable.toWeb(fs.createReadStream(filePath, { start, end }));
          return new NextResponse(chunk as any, {
            status: 206,
            headers: {
              ...headers,
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Content-Length': (end - start + 1).toString(),
            },
          });
        }
      }
    }

    const stream = Readable.toWeb(fs.createReadStream(filePath));
    return new NextResponse(stream as any, {
      headers: {
        ...headers,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (err) {
    console.error('Recording file error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
