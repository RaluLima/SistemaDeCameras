import prisma from "@/lib/prisma";

export const RETENTION_OPTIONS = [7, 15, 30, 60, 90] as const;

export type PlanInfo = {
  plan?: string | null;
  planExpiresAt?: Date | string | null;
};

export function hasAIAccess(user: PlanInfo | null | undefined): boolean {
  if (!user) return false;
  if (user.plan !== "PAID") return false;
  if (!user.planExpiresAt) return true;
  const expiresAt = new Date(user.planExpiresAt);
  return expiresAt.getTime() > Date.now();
}

export function isRetentionDaysValid(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    RETENTION_OPTIONS.includes(value as (typeof RETENTION_OPTIONS)[number])
  );
}

export function retentionCutoff(retentionDays: number): Date {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function cleanupExpiredRecordings(cameraId?: string): Promise<number> {
  const cameras = await prisma.camera.findMany({
    where: cameraId ? { id: cameraId } : {},
    select: { id: true, retentionDays: true },
  });

  let total = 0;
  for (const cam of cameras) {
    const cutoff = retentionCutoff(cam.retentionDays);
    const result = await prisma.recording.deleteMany({
      where: { cameraId: cam.id, createdAt: { lt: cutoff } },
    });
    total += result.count;
  }
  return total;
}
