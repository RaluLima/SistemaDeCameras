import prisma from '@/lib/prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(userId: string, message: PushMessage) {
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });
    if (tokens.length === 0) return { sent: 0, errors: [] };

    const payload = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      priority: 'high',
      title: message.title,
      body: message.body,
      data: message.data || {},
    }));

    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      return { sent: 0, errors: [`Expo push HTTP ${resp.status}`] };
    }

    const body = (await resp.json()) as
      | {
          data?: {
            status: string;
            message?: string;
            details?: { error?: string };
          }[];
        }
      | {
          status: string;
          message?: string;
          details?: { error?: string };
        }[];
    const results = Array.isArray(body) ? body : body.data ?? [];

    let sent = 0;
    const errors: string[] = [];
    const invalidIds: string[] = [];

    results.forEach((r, i) => {
      if (r.status === 'ok') {
        sent += 1;
        return;
      }
      errors.push(r.message || 'erro no envio');
      const raw = r.details?.error || r.message || '';
      if (/DeviceNotRegistered|invalid/.test(raw)) invalidIds.push(tokens[i].id);
    });

    if (invalidIds.length > 0) {
      await prisma.pushToken.deleteMany({ where: { id: { in: invalidIds } } });
    }

    return { sent, errors };
  } catch (err) {
    console.error('Push send error:', err);
    return { sent: 0, errors: [(err as Error).message] };
  }
}

const ALERT_TITLES: Record<string, string> = {
  FALL_DETECTED: '⚠️ Queda detectada',
  INTRUSION: '🚨 Intrusão detectada',
  SUSPICIOUS_MOVEMENT: '👀 Movimento suspeito',
  CONNECTION_LOST: '📡 Câmera desconectada',
};

export function alertPushMessage(params: {
  type: string;
  description: string;
  alertId: string;
  cameraId: string;
  cameraName: string;
}): PushMessage {
  return {
    title: ALERT_TITLES[params.type] || 'Alerta de segurança',
    body: `${params.cameraName}: ${params.description}`,
    data: {
      alertId: params.alertId,
      cameraId: params.cameraId,
      type: params.type,
    },
  };
}
