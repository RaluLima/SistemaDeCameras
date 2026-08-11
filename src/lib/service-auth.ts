import { NextRequest } from 'next/server';

export function hasServiceAccess(req: NextRequest, envKey: string): boolean {
  const key = process.env[envKey];
  if (!key) return false;
  const provided = req.headers.get('x-service-key');
  return provided === key;
}

export function hasRecorderAccess(req: NextRequest): boolean {
  return hasServiceAccess(req, 'RECORDING_SERVICE_KEY');
}
