export type Role = 'ADMIN' | 'USER';
export type Plan = 'FREE' | 'PAID';

export interface User {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  role: Role;
  plan: Plan;
  planExpiresAt: string | null;
  phone: string | null;
  mustChangePassword: boolean;
}

export interface Camera {
  id: string;
  name: string;
  streamUrl: string | null;
  type: string;
  status: string;
  retentionDays: number;
  recordingEnabled: boolean;
  aiMonitoringEnabled: boolean;
  userId: string;
}

export interface Recording {
  id: string;
  filePath: string;
  duration: number;
  size: number;
  createdAt: string;
  camera: {
    name: string;
    retentionDays: number;
    userId: string;
    streamUrl: string | null;
  };
}

export interface Alert {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  processed: boolean;
  cameraId: string;
  camera?: { name: string };
}
