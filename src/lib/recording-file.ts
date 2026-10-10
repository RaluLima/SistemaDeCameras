import fs from "fs";
import path from "path";

export function recordingsDir(): string {
  return path.resolve(process.env.RECORDINGS_DIR || path.join(process.cwd(), "recordings"));
}

/**
 * So permite mexer em arquivo local dentro de recordings/.
 * filePath remoto (http/https) e path fora da raiz sao recusados.
 */
export function isRecordingPathSafe(filePath: string): boolean {
  if (!filePath || /^https?:\/\//i.test(filePath)) return false;
  const resolved = path.resolve(filePath);
  const root = recordingsDir();
  return resolved === root || resolved.startsWith(root + path.sep);
}

export function deleteRecordingFile(filePath: string): boolean {
  try {
    if (!isRecordingPathSafe(filePath)) return false;
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
