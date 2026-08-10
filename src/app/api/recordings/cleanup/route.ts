import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { cleanupExpiredRecordings } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  try {
    const deleted = await cleanupExpiredRecordings();
    return NextResponse.json({ deleted });
  } catch {
    return NextResponse.json({ error: "Erro ao limpar gravações" }, { status: 500 });
  }
}
