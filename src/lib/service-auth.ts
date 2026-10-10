import { NextRequest } from 'next/server';

export function hasServiceAccess(req: NextRequest, envKey: string): boolean {
  const key = process.env[envKey];
  if (!key) return false;
  const provided = req.headers.get('x-service-key');
  return provided === key;
}

export function hasRecorderAccess(req: NextRequest): boolean {
  const key = process.env.RECORDING_SERVICE_KEY;
  if (!key) return false;
  // o recorder/worker.js envia x-recorder-key; x-service-key fica como fallback
  const provided = req.headers.get('x-recorder-key') || req.headers.get('x-service-key');
  return provided === key;
}
