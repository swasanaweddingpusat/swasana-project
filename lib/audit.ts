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
    // ActivityLog.userId FK references Profile.id
    // Resolve: if passed value is a User.id, look up the Profile.id
    let profileId = params.userId;
    if (profileId) {
      const profile = await db.profile.findUnique({
        where: { userId: profileId },
        select: { id: true },
      });
      if (profile) {
        profileId = profile.id;
      }
      // If no profile found by userId, assume it's already a profileId
    }

    await db.activityLog.create({
      data: {
        userId: profileId,
        action: params.action,
        result: params.result ?? "success",
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes ?? {},
        description: params.description,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
