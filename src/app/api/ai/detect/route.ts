import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { hasAIAccess } from "@/lib/plan";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { cameraId, streamUrl } = body;
  if (!cameraId) {
    return NextResponse.json({ error: "cameraId obrigatório" }, { status: 400 });
  }

  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true, userId: true, streamUrl: true },
  });
  if (!camera) {
    return NextResponse.json({ error: "Câmera não encontrada" }, { status: 404 });
  }
  if (auth.role !== "ADMIN" && camera.userId !== auth.id) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }

  if (auth.role !== "ADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { plan: true, planExpiresAt: true },
    });
    if (!hasAIAccess(user)) {
      return NextResponse.json(
        {
          error:
            "Seu plano gratuito não inclui o monitoramento com IA. Ative o plano Pagante para usar este recurso.",
        },
        { status: 403 }
      );
    }
  }

  const aiUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";
  const targetUrl = streamUrl || camera.streamUrl;
  if (!targetUrl) {
    return NextResponse.json(
      { error: "Câmera sem URL de stream configurada" },
      { status: 400 }
    );
  }

  try {
    const form = new URLSearchParams();
    form.set("stream_url", targetUrl);
    const resp = await fetch(`${aiUrl}/detect/${camera.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(90000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { error: "Serviço de IA indisponível no momento" },
      { status: 502 }
    );
  }
}
