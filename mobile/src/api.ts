import { API_BASE } from './config';
import { Alert, Camera, Recording, User } from './types';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Erro ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      // corpo nao e json
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/api/auth/token', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/api/me'),
  cameras: () => request<Camera[]>('/api/cameras'),
  updateCamera: (id: string, data: { recordingEnabled?: boolean; aiMonitoringEnabled?: boolean }) =>
    request<Camera>(`/api/cameras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  recordings: () => request<Recording[]>('/api/recordings'),
  alerts: () => request<Alert[]>('/api/alerts'),
  markAlertRead: (id: string) =>
    request<Alert>(`/api/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ processed: true }),
    }),
  registerPush: (token: string) =>
    request<{ status: string }>('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'expo' }),
    }),
};
