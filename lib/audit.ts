import { db } from "@/lib/db";

interface AuditLogInput {
  userId?: string;
  action: string;
  result?: "success" | "failure";
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: AuditLogInput): Promise<void> {
  try {
    let profileId = params.userId;
    if (profileId) {
      // Callers usually pass session.user.id (a User id) but some pass a profileId.
      // Resolve both cases in ONE round-trip (was two sequential findUnique calls):
      // match a profile by userId OR id, preferring the userId match.
      const raw = profileId;
      const candidates = await db.profile.findMany({
        where: { OR: [{ userId: raw }, { id: raw }] },
        select: { id: true, userId: true },
        take: 2,
      });
      const resolved =
        candidates.find((p) => p.userId === raw) ?? candidates.find((p) => p.id === raw);
      if (!resolved) {
        // Profile not found — skip audit log silently
        return;
      }
      profileId = resolved.id;
    }

    await db.activityLog.create({
      data: {
        userId: profileId,
        action: params.action,
        result: params.result ?? "success",
        entityType: params.entityType,
        entityId: params.entityId,
        changes: (params.changes ?? {}) as never,
        description: params.description,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
