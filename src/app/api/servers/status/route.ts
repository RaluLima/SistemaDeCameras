import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { getRecorderStatus } from "@/lib/servers";
import { exec } from "child_process";
import { promisify } from "util";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

interface ServiceStatus {
  key: string;
  name: string;
  status: "running" | "stopped" | "error";
  port?: number;
  pid?: number;
}

async function checkPort(port: number): Promise<{ running: boolean; pid?: number }> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`);
    const match = stdout.match(/LISTENING\s+(\d+)/m);
    if (match) return { running: true, pid: parseInt(match[1]) };
    return { running: false };
  } catch {
    return { running: false };
  }
}

async function probe(key: string, name: string, port: number): Promise<ServiceStatus> {
  const r = await checkPort(port);
  return { key, name, status: r.running ? "running" : "stopped", port, pid: r.pid };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const services = await Promise.all([
      probe("postgresql", "PostgreSQL", 5432),
      probe("redis", "Redis", 6379),
      probe("nextjs", "Next.js", 3000),
      probe("mediamtx", "MediaMTX", 8888),
      probe("ai", "AI Service", 8000),
      probe("cloudflare", "Cloudflare Tunnel", 20241),
      getRecorderStatus(),
    ]);

    return NextResponse.json({ services, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}