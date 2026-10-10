import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();
export const RECORDER_PID_FILE = path.join(PROJECT_DIR, "recorder", "worker.pid");

export interface RecorderStatus {
  key: string;
  name: string;
  status: "running" | "stopped";
  pid?: number;
}

export async function readRecorderPid(): Promise<number | null> {
  try {
    const raw = await fs.promises.readFile(RECORDER_PID_FILE, "utf8");
    const pid = parseInt(raw.trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export async function pidAlive(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH`);
    return stdout.includes(String(pid));
  } catch {
    return false;
  }
}

export async function getRecorderStatus(): Promise<RecorderStatus> {
  const pid = await readRecorderPid();
  if (pid && (await pidAlive(pid))) {
    return { key: "recorder", name: "Recorder", status: "running", pid };
  }
  return { key: "recorder", name: "Recorder", status: "stopped" };
}

export async function readEnvFile(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const raw = await fs.promises.readFile(path.join(PROJECT_DIR, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* .env ausente */
  }
  return out;
}