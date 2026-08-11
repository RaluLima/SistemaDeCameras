/*
 * Recorder Worker — captura segmentos de câmeras habilitadas para gravação.
 *
 * Uso:
 *   API_URL=https://sistemadecameras.onrender.com \
 *   RECORDER_KEY=<mesmo valor de RECORDING_SERVICE_KEY do app> \
 *   FFMPEG=ffmpeg \
 *   OUTPUT_DIR=./recordings \
 *   SEGMENT_SECONDS=60 \
 *   POLL_INTERVAL=30 \
 *   node recorder/worker.js
 *
 * Fluxo:
 *   1. Poll em GET /api/cameras/recording-jobs (auth via X-Recorder-Key).
 *   2. Para cada câmera, grava segmentos mp4 de SEGMENT_SECONDS via ffmpeg.
 *   3. Registra cada segmento via POST /api/recordings (X-Recorder-Key).
 *
 * filePath é salvo como caminho local. Para armazenamento persistente (S3/R2),
 * suba o arquivo e troque filePath pela URL antes do POST.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const RECORDER_KEY = process.env.RECORDER_KEY;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'recordings');
const SEGMENT_SECONDS = parseInt(process.env.SEGMENT_SECONDS || '60', 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30', 10) * 1000;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '2', 10);

if (!RECORDER_KEY) {
  console.error('[recorder] RECORDER_KEY é obrigatório (use o valor de RECORDING_SERVICE_KEY do app).');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const active = new Map(); // cameraId -> { job, stop }

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJobs() {
  const res = await fetch(`${API_URL}/api/cameras/recording-jobs`, {
    headers: { 'x-recorder-key': RECORDER_KEY },
  });
  if (!res.ok) throw new Error(`GET recording-jobs -> ${res.status}`);
  return res.json();
}

async function registerRecording(cameraId, filePath, size, startedAt) {
  const res = await fetch(`${API_URL}/api/recordings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-recorder-key': RECORDER_KEY,
    },
    body: JSON.stringify({
      cameraId,
      filePath,
      duration: SEGMENT_SECONDS,
      size,
      startedAt: startedAt.toISOString(),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`POST /api/recordings -> ${res.status} ${body}`);
  }
}

function runFfmpeg(camera, outputFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-rtsp_transport', 'tcp',
      '-i', camera.streamUrl,
      '-t', String(SEGMENT_SECONDS),
      '-c', 'copy',
      '-movflags', '+faststart',
      outputFile,
    ];
    log(`[${camera.name}] ffmpeg ${args.join(' ')}`);

    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    const killTimer = setTimeout(() => {
      log(`[${camera.name}] ffmpeg estourou o tempo, encerrando.`);
      proc.kill('SIGKILL');
    }, (SEGMENT_SECONDS + 20) * 1000);

    proc.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg saiu com código ${code}\n${stderr.trim().split('\n').slice(-5).join('\n')}`));
    });
  });
}

async function recordCamera(job, isActive) {
  const dir = path.join(OUTPUT_DIR, job.id);
  fs.mkdirSync(dir, { recursive: true });

  while (isActive(job.id)) {
    const startedAt = new Date();
    const ts = startedAt.toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(dir, `${ts}.mp4`);

    try {
      await runFfmpeg(job, outputFile);
      const stat = fs.statSync(outputFile);
      if (stat.size > 0) {
        const abs = path.resolve(outputFile);
        await registerRecording(job.id, abs, stat.size, startedAt);
        log(`[${job.name}] segmento gravado: ${abs} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        fs.unlinkSync(outputFile);
        log(`[${job.name}] segmento vazio, ignorado.`);
      }
    } catch (err) {
      try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch {}
      log(`[${job.name}] erro na gravação: ${err.message}`);
      await sleep(POLL_INTERVAL);
    }
  }
  log(`[${job.name}] parado.`);
}

async function syncLoop() {
  let jobs = [];
  try {
    jobs = await fetchJobs();
  } catch (err) {
    log(`erro ao buscar jobs: ${err.message}`);
  }

  const ids = new Set(jobs.map((j) => j.id));

  for (const job of jobs) {
    if (!active.has(job.id) && active.size < CONCURRENCY) {
      log(`[${job.name}] iniciando gravação.`);
      const entry = { job, stop: false };
      active.set(job.id, entry);
      recordCamera(job, (id) => !active.get(id)?.stop && ids.has(id)).catch((err) =>
        log(`[${job.name}] loop encerrou com erro: ${err.message}`)
      );
    }
  }

  for (const [id, entry] of active) {
    if (!ids.has(id)) {
      log(`[${entry.job.name}] câmera não está mais na lista, parando.`);
      entry.stop = true;
      active.delete(id);
    }
  }
}

async function main() {
  log(`worker iniciado. API=${API_URL} ffmpeg=${FFMPEG} output=${OUTPUT_DIR} segmento=${SEGMENT_SECONDS}s poll=${POLL_INTERVAL / 1000}s`);
  await syncLoop();
  setInterval(syncLoop, POLL_INTERVAL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
