import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PG_BIN = "C:\\Program Files\\PostgreSQL\\16\\bin";
const PG_DATA = "C:\\Program Files\\PostgreSQL\\16\\data";
const PROJECT_DIR = "F:\\SistemaDeCameras-main";

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

async function killPort(port: number): Promise<boolean> {
  const check = await checkPort(port);
  if (check.running && check.pid) {
    try {
      await execAsync(`taskkill /F /PID ${check.pid}`);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function startPostgreSQL(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await checkPort(5432);
    if (status.running) {
      return { success: true, message: "PostgreSQL já está rodando" };
    }
    await execAsync(`"${PG_BIN}\\pg_ctl" start -D "${PG_DATA}" -l "${PG_DATA}\\startup.log" -w`);
    await new Promise(r => setTimeout(r, 3000));
    const newStatus = await checkPort(5432);
    return { 
      success: newStatus.running, 
      message: newStatus.running ? "PostgreSQL iniciado com sucesso" : "Falha ao iniciar PostgreSQL" 
    };
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

async function stopPostgreSQL(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await checkPort(5432);
    if (!status.running) {
      return { success: true, message: "PostgreSQL já está parado" };
    }
    await execAsync(`"${PG_BIN}\\pg_ctl" stop -D "${PG_DATA}" -m fast`);
    await new Promise(r => setTimeout(r, 2000));
    return { success: true, message: "PostgreSQL parado com sucesso" };
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

async function startNextJS(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await checkPort(3000);
    if (status.running) {
      return { success: true, message: "Next.js já está rodando" };
    }
    await execAsync(`Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '${PROJECT_DIR}'; node node_modules\\next\\dist\\bin\\next start -p 3000 -H 0.0.0.0" -WindowStyle Hidden`, { shell: "powershell" });
    await new Promise(r => setTimeout(r, 8000));
    const newStatus = await checkPort(3000);
    return { 
      success: newStatus.running, 
      message: newStatus.running ? "Next.js iniciado com sucesso" : "Falha ao iniciar Next.js" 
    };
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

async function stopNextJS(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await checkPort(3000);
    if (!status.running) {
      return { success: true, message: "Next.js já está parado" };
    }
    await killPort(3000);
    await new Promise(r => setTimeout(r, 2000));
    return { success: true, message: "Next.js parado com sucesso" };
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

async function startCloudflare(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await checkPort(20241);
    if (status.running) {
      return { success: true, message: "Cloudflare Tunnel já está rodando" };
    }
    const cloudflared = `${PROJECT_DIR}\\cloudflared.exe`;
    await execAsync(`Start-Process -FilePath "${cloudflared}" -ArgumentList "tunnel", "--url", "http://localhost:3000" -WindowStyle Hidden`, { shell: "powershell" });
    await new Promise(r => setTimeout(r, 10000));
    const newStatus = await checkPort(20241);
    return { 
      success: newStatus.running, 
      message: newStatus.running ? "Cloudflare Tunnel iniciado com sucesso" : "Falha ao iniciar Cloudflare Tunnel" 
    };
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

async function stopCloudflare(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await checkPort(20241);
    if (!status.running) {
      return { success: true, message: "Cloudflare Tunnel já está parado" };
    }
    await killPort(20241);
    await new Promise(r => setTimeout(r, 2000));
    return { success: true, message: "Cloudflare Tunnel parado com sucesso" };
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { service, action } = await req.json();
    
    if (!service || !action) {
      return NextResponse.json({ error: "Serviço e ação são obrigatórios" }, { status: 400 });
    }

    if (!["postgresql", "nextjs", "cloudflare"].includes(service)) {
      return NextResponse.json({ error: "Serviço inválido" }, { status: 400 });
    }

    if (!["start", "stop", "toggle"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    let result: { success: boolean; message: string };

    const handlers: Record<string, Record<string, () => Promise<{ success: boolean; message: string }>>> = {
      postgresql: { start: startPostgreSQL, stop: stopPostgreSQL },
      nextjs: { start: startNextJS, stop: stopNextJS },
      cloudflare: { start: startCloudflare, stop: stopCloudflare },
    };

    if (action === "toggle") {
      const status = await checkPort(
        service === "postgresql" ? 5432 : service === "nextjs" ? 3000 : 20241
      );
      const toggleAction = status.running ? "stop" : "start";
      result = await handlers[service][toggleAction]();
    } else {
      result = await handlers[service][action]();
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
