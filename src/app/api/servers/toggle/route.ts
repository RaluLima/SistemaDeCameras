import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import {
  PROJECT_DIR,
  RECORDER_PID_FILE,
  getRecorderStatus,
  pidAlive,
  readEnvFile,
  readRecorderPid,
} from "@/lib/servers";
import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import { promisify } from "util";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

const REDIS_DIR = path.join(PROJECT_DIR, "tools", "redis");

function findPgCtl(): string | null {
  if (process.env.PG_BIN) {
    const p = path.join(process.env.PG_BIN, "pg_ctl.exe");
    return fs.existsSync(p) ? p : null;
  }
  const candidates = [
    "D:\\PostgreSQL\\18\\bin\\pg_ctl.exe",
    "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_ctl.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function findPgData(): string | null {
  if (process.env.PG_DATA) return fs.existsSync(process.env.PG_DATA) ? process.env.PG_DATA : null;
  const candidates = [
    "D:\\PostgreSQL\\18\\data",
    "C:\\Program Files\\PostgreSQL\\18\\data",
    "C:\\Program Files\\PostgreSQL\\17\\data",
    "C:\\Program Files\\PostgreSQL\\16\\data",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
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

async function waitPort(port: number, seconds: number): Promise<boolean> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if ((await checkPort(port)).running) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return (await checkPort(port)).running;
}

async function killPort(port: number): Promise<boolean> {
  const check = await checkPort(port);
  if (check.running && check.pid) {
    try {
      await execAsync(`taskkill /F /PID ${check.pid}`);
      await execAsync(`taskkill /F /T /PID ${check.pid}`);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function startHidden(file: string, args: string, cwd: string) {
  const argList = args
    .split(" ")
    .map((a) => (a.includes(" ") ? `"${a}"` : a))
    .join(",");
  return execAsync(
    `Start-Process -FilePath "${file}" -ArgumentList ${argList} -WorkingDirectory "${cwd}" -WindowStyle Hidden`,
    { shell: "powershell" }
  );
}

type Result = { success: boolean; message: string };
const ok = (m: string): Result => ({ success: true, message: m });
const fail = (m: string): Result => ({ success: false, message: m });

const SERVICES: Record<string, number> = {
  postgresql: 5432,
  redis: 6379,
  nextjs: 3000,
  mediamtx: 8888,
  ai: 8000,
  cloudflare: 20241,
};

const RECORDER_WORKER = path.join(PROJECT_DIR, "recorder", "worker.js");

async function startRecorder(): Promise<Result> {
  const pid = await readRecorderPid();
  if (pid && (await pidAlive(pid))) return ok("Recorder já está rodando");

  const env = await readEnvFile();
  const worker = RECORDER_WORKER;
  if (!fs.existsSync(worker)) return fail("recorder/worker.js não encontrado");
  if (!env.RECORDING_SERVICE_KEY) return fail("RECORDING_SERVICE_KEY não está definido no .env");

  const ffmpeg = path.join(PROJECT_DIR, "tools", "ffmpeg", "bin", "ffmpeg.exe");
  // spawn detached + stdio em arquivos: o worker nao herda pipes do servidor Next.js
  // (com exec/Start-Process os pipes ficam abertos e a requisicao HTTP trava).
  const outFd = fs.openSync(path.join(PROJECT_DIR, "recorder.log"), "a");
  const errFd = fs.openSync(path.join(PROJECT_DIR, "recorder-error.log"), "a");

  try {
    const child = spawn(process.execPath, [worker], {
      cwd: PROJECT_DIR,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", outFd, errFd],
      env: {
        ...process.env,
        API_URL: "http://localhost:3000",
        RECORDER_KEY: env.RECORDING_SERVICE_KEY,
        FFMPEG: fs.existsSync(ffmpeg) ? ffmpeg : "ffmpeg",
        OUTPUT_DIR: env.RECORDINGS_DIR || path.join(PROJECT_DIR, "recordings"),
      },
    });
    child.unref();

    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const p = await readRecorderPid();
      if (p && (await pidAlive(p))) return ok(`Recorder iniciado (PID ${p})`);
    }
    return fail("Recorder não subiu — veja recorder.log");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopRecorder(): Promise<Result> {
  const pid = await readRecorderPid();
  if (!pid) return ok("Recorder já está parado");
  try {
    await execAsync(`taskkill /F /T /PID ${pid}`);
  } catch {
    // ja estava parado
  }
  // taskkill /F nao deixa o worker limpar o proprio pid file
  try {
    fs.unlinkSync(RECORDER_PID_FILE);
  } catch {}
  return ok("Recorder parado");
}

async function startPostgreSQL(): Promise<Result> {
  const pgCtl = findPgCtl();
  const pgData = findPgData();
  if (!pgCtl || !pgData) {
    return fail("pg_ctl não encontrado. Defina PG_BIN e PG_DATA no .env");
  }
  try {
    await execAsync(`"${pgCtl}" start -D "${pgData}" -l "${path.join(pgData, "startup.log")}" -w`);
    return (await waitPort(5432, 20)) ? ok("PostgreSQL iniciado") : fail("PostgreSQL não abriu a porta 5432");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopPostgreSQL(): Promise<Result> {
  const pgCtl = findPgCtl();
  const pgData = findPgData();
  if (!pgCtl || !pgData) return fail("pg_ctl não encontrado. Defina PG_BIN e PG_DATA no .env");
  try {
    await execAsync(`"${pgCtl}" stop -D "${pgData}" -m fast`);
    return ok("PostgreSQL parado");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function startRedis(): Promise<Result> {
  const exe = path.join(REDIS_DIR, "redis-server.exe");
  const conf = path.join(REDIS_DIR, "redis.windows.conf");
  if (!fs.existsSync(exe)) return fail(`redis-server.exe não encontrado em ${REDIS_DIR}`);
  try {
    await startHidden(exe, conf, REDIS_DIR);
    return (await waitPort(6379, 15)) ? ok("Redis iniciado") : fail("Redis não abriu a porta 6379");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopRedis(): Promise<Result> {
  const cli = path.join(REDIS_DIR, "redis-cli.exe");
  try {
    if (fs.existsSync(cli)) {
      await execAsync(`"${cli}" shutdown`).catch(() => {});
      if (await waitPort(6379, 10)) return fail("Redis ainda respondendo");
    }
    await killPort(6379);
    return ok("Redis parado");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function startNextJS(): Promise<Result> {
  if (!fs.existsSync(path.join(PROJECT_DIR, "server.js"))) {
    return fail("server.js não encontrado — rode o build antes (npx next build)");
  }
  try {
    await execAsync(
      `Start-Process powershell -ArgumentList "-NoProfile","-Command","Set-Location '${PROJECT_DIR}'; node server.js *> '${path.join(PROJECT_DIR, "server.log")}'" -WindowStyle Hidden`,
      { shell: "powershell" }
    );
    return (await waitPort(3000, 45)) ? ok("Next.js iniciado") : fail("Next.js não abriu a porta 3000 — veja server.log");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopNextJS(): Promise<Result> {
  await killPort(3000);
  return ok("Next.js parado");
}

async function startMediaMTX(): Promise<Result> {
  const exe = path.join(PROJECT_DIR, "mediamtx.exe");
  const conf = path.join(PROJECT_DIR, "mediamtx.yml");
  if (!fs.existsSync(exe)) return fail("mediamtx.exe não encontrado");
  try {
    await startHidden(exe, conf, PROJECT_DIR);
    return (await waitPort(8888, 15)) ? ok("MediaMTX iniciado") : fail("MediaMTX não abriu a porta 8888");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopMediaMTX(): Promise<Result> {
  await killPort(8888);
  await killPort(8554);
  await killPort(8889);
  return ok("MediaMTX parado");
}

async function startAI(): Promise<Result> {
  const dir = path.join(PROJECT_DIR, "ai-service");
  try {
    await execAsync(
      `Start-Process powershell -ArgumentList "-NoProfile","-Command","Set-Location '${dir}'; python main.py *> '${path.join(PROJECT_DIR, "ai-service.log")}'" -WindowStyle Hidden`,
      { shell: "powershell" }
    );
    return (await waitPort(8000, 30)) ? ok("AI Service iniciado") : fail("AI Service não subiu — veja ai-service.log");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopAI(): Promise<Result> {
  await killPort(8000);
  return ok("AI Service parado");
}

async function startCloudflare(): Promise<Result> {
  const exe = path.join(PROJECT_DIR, "cloudflared.exe");
  if (!fs.existsSync(exe)) return fail("cloudflared.exe não encontrado");
  const errLog = path.join(PROJECT_DIR, "tunnel-err.log");
  try {
    if (fs.existsSync(errLog)) fs.unlinkSync(errLog);
    await execAsync(
      `Start-Process -FilePath "${exe}" -ArgumentList "tunnel","--url","http://localhost:3000" -WorkingDirectory "${PROJECT_DIR}" -RedirectStandardError "${errLog}" -WindowStyle Hidden`,
      { shell: "powershell" }
    );
    const up = await waitPort(20241, 30);
    if (!up) return fail("Túnel não conectou — veja tunnel-err.log");
    let url = "";
    try {
      const log = fs.readFileSync(errLog, "utf8");
      const m = log.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
      if (m) url = m[m.length - 1];
    } catch {}
    return ok(url ? `Túnel ativo: ${url}` : "Túnel ativo");
  } catch (e: any) {
    return fail(`Erro: ${(e.message || "").split("\n")[0]}`);
  }
}

async function stopCloudflare(): Promise<Result> {
  await killPort(20241);
  return ok("Túnel parado");
}

const HANDLERS: Record<string, { start: () => Promise<Result>; stop: () => Promise<Result> }> = {
  postgresql: { start: startPostgreSQL, stop: stopPostgreSQL },
  redis: { start: startRedis, stop: stopRedis },
  nextjs: { start: startNextJS, stop: stopNextJS },
  mediamtx: { start: startMediaMTX, stop: stopMediaMTX },
  ai: { start: startAI, stop: stopAI },
  cloudflare: { start: startCloudflare, stop: stopCloudflare },
  recorder: { start: startRecorder, stop: stopRecorder },
};

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
    if (!HANDLERS[service] || !(SERVICES[service] || service === "recorder")) {
      return NextResponse.json({ error: "Serviço inválido" }, { status: 400 });
    }
    if (!["start", "stop", "toggle"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    let resolved: "start" | "stop";
    if (action !== "toggle") {
      resolved = action;
    } else if (service === "recorder") {
      resolved = (await getRecorderStatus()).status === "running" ? "stop" : "start";
    } else {
      resolved = (await checkPort(SERVICES[service])).running ? "stop" : "start";
    }

    const result = await HANDLERS[service][resolved]();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}