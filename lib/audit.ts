import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

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
      const profile = await db.profile.findUnique({
        where: { userId: profileId },
        select: { id: true },
      });
      if (profile) {
        profileId = profile.id;
      } else {
        // Check if it's already a profileId
        const directProfile = await db.profile.findUnique({
          where: { id: profileId },
          select: { id: true },
        });
        if (!directProfile) {
          // Profile not found — skip audit log silently
          return;
        }
      }
    }

    await db.activityLog.create({
      data: {
        userId: profileId,
        action: params.action,
        result: params.result ?? "success",
        entityType: params.entityType,
        entityId: params.entityId,
        changes: (params.changes ?? {}) as Prisma.InputJsonValue,
        description: params.description,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
