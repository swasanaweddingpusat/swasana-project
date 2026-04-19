import { db } from "@/lib/db";

interface AuditLogInput {
  userId?: string;
  action: string; // "auth.login", "user.invited", "role.created", etc.
  result?: "success" | "failure";
  entityType: string; // "auth", "profile", "role", "permission"
  entityId: string;
  changes?: Record<string, unknown>; // { before: {...}, after: {...} }
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: AuditLogInput): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: params.userId,
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
    // NEVER throw — audit failure must not block business logic
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
