import { NextRequest } from 'next/server';

export function hasRecorderAccess(req: NextRequest): boolean {
  const key = process.env.RECORDING_SERVICE_KEY;
  if (!key) return false;
  const provided = req.headers.get('x-recorder-key');
  return provided === key;
}
