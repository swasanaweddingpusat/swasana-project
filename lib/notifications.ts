import { db } from "@/lib/db";

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Create a notification for a single user.
 * Non-blocking — never throws, never blocks the caller.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await db.notification.create({ data: input });
  } catch {
    // Silent fail — notification failure must never block business logic
  }
}

/**
 * Create notifications for multiple users at once.
 */
export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  try {
    for (const input of inputs) {
      await db.notification.create({ data: input });
    }
  } catch {
    // Silent fail
  }
}

/**
 * Notify all users with a specific role.
 */
export async function notifyRole(roleId: string, notification: Omit<CreateNotificationInput, "userId">): Promise<void> {
  try {
    const profiles = await db.profile.findMany({
      where: { roleId, status: "active" },
      select: { id: true },
    });
    for (const p of profiles) {
      await db.notification.create({ data: { ...notification, userId: p.id } });
    }
  } catch {
    // Silent fail
  }
}

/**
 * Notify all super admins. Skips excludeUserId to avoid self-notification.
 */
export async function notifySuperAdmins(notification: Omit<CreateNotificationInput, "userId">, excludeUserId?: string): Promise<void> {
  try {
    const adminRole = await db.role.findFirst({ where: { name: "Super Admin" } });
    if (!adminRole) return;
    const profiles = await db.profile.findMany({
      where: { roleId: adminRole.id, status: "active", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
      select: { id: true },
    });
    for (const p of profiles) {
      await db.notification.create({ data: { ...notification, userId: p.id } });
    }
  } catch {
    // Silent fail
  }
}
