import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error";
  port?: number;
  pid?: number;
  uptime?: string;
}

async function checkPort(port: number): Promise<{ running: boolean; pid?: number }> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`);
    const match = stdout.trim().match(/LISTENING\s+(\d+)$/);
    if (match) {
      return { running: true, pid: parseInt(match[1]) };
    }
    return { running: false };
  } catch {
    return { running: false };
  }
}

async function getPostgreSQLStatus(): Promise<ServiceStatus> {
  const pgBin = "C:\\Program Files\\PostgreSQL\\16\\bin";
  const pgData = "C:\\Program Files\\PostgreSQL\\16\\data";
  
  try {
    const { stdout } = await execAsync(`"${pgBin}\\pg_ctl" status -D "${pgData}"`);
    const portCheck = await checkPort(5432);
    return {
      name: "PostgreSQL",
      status: portCheck.running ? "running" : "stopped",
      port: 5432,
      pid: portCheck.pid,
    };
  } catch {
    return {
      name: "PostgreSQL",
      status: "stopped",
      port: 5432,
    };
  }
}

async function getNextJSStatus(): Promise<ServiceStatus> {
  const portCheck = await checkPort(3000);
  return {
    name: "Next.js",
    status: portCheck.running ? "running" : "stopped",
    port: 3000,
    pid: portCheck.pid,
  };
}

async function getCloudflareStatus(): Promise<ServiceStatus> {
  const portCheck = await checkPort(20241);
  return {
    name: "Cloudflare Tunnel",
    status: portCheck.running ? "running" : "stopped",
    port: 20241,
    pid: portCheck.pid,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [postgres, nextjs, cloudflare] = await Promise.all([
      getPostgreSQLStatus(),
      getNextJSStatus(),
      getCloudflareStatus(),
    ]);

    return NextResponse.json({
      services: [postgres, nextjs, cloudflare],
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
