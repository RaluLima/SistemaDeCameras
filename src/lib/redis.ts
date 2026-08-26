import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

function getPubClient(): Redis {
  if (!pubClient) {
    pubClient = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
    pubClient.on("error", (err) => console.error("[Redis] Erro no pub:", err.message));
    pubClient.connect().catch(() => {});
  }
  return pubClient;
}

function getSubClient(): Redis {
  if (!subClient) {
    subClient = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
    subClient.on("error", (err) => console.error("[Redis] Erro no sub:", err.message));
    subClient.connect().catch(() => {});
  }
  return subClient;
}

export function publishAlert(channel: string, data: object) {
  const pub = getPubClient();
  pub.publish(channel, JSON.stringify(data));
}

export function subscribeAlerts(channel: string, callback: (data: object) => void) {
  const sub = getSubClient();
  sub.subscribe(channel);
  sub.on("message", (_ch, message) => {
    if (_ch === channel) {
      try {
        callback(JSON.parse(message));
      } catch {}
    }
  });
}

export { getPubClient, getSubClient };
