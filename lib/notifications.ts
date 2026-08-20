import { db } from "@/lib/db";
import { sendPushNotification, getNotificationUrl } from "@/lib/push";

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
  isMention?: boolean;
  commentId?: string;
}

/**
 * Create a notification for a single user.
 * Non-blocking — never throws, never blocks the caller.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await db.notification.create({ data: input });

    sendPushNotification(input.userId, {
      title: input.title,
      body: input.message,
      url: getNotificationUrl(input.type, input.entityId),
      tag: input.type,
    }).catch(() => {});
  } catch {
    // Silent fail — notification failure must never block business logic
  }
}

/**
 * Create notifications for multiple users at once.
 * Batched into a single array-form transaction — over Neon HTTP that's one
 * round-trip instead of one per notification. (createMany is not supported on the
 * Neon HTTP adapter, so we use the array-form $transaction.)
 */
export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await db.$transaction(inputs.map((input) => db.notification.create({ data: input })));

    for (const input of inputs) {
      sendPushNotification(input.userId, {
        title: input.title,
        body: input.message,
        url: getNotificationUrl(input.type, input.entityId, input.entityType),
        tag: input.type,
      }).catch(() => {});
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
      take: 500,
    });
    if (profiles.length === 0) return;
    await db.$transaction(
      profiles.map((p) => db.notification.create({ data: { ...notification, userId: p.id } })),
    );

    for (const p of profiles) {
      sendPushNotification(p.id, {
        title: notification.title,
        body: notification.message,
        url: getNotificationUrl(notification.type, notification.entityId, notification.entityType),
        tag: notification.type,
      }).catch(() => {});
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
    const adminRole = await db.role.findFirst({ where: { isSystemRole: true }, select: { id: true } });
    if (!adminRole) return;
    const profiles = await db.profile.findMany({
      where: { roleId: adminRole.id, status: "active", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
      select: { id: true },
      take: 100,
    });
    if (profiles.length === 0) return;
    await db.$transaction(
      profiles.map((p) => db.notification.create({ data: { ...notification, userId: p.id } })),
    );

    for (const p of profiles) {
      sendPushNotification(p.id, {
        title: notification.title,
        body: notification.message,
        url: getNotificationUrl(notification.type, notification.entityId, notification.entityType),
        tag: notification.type,
      }).catch(() => {});
    }
  } catch {
    // Silent fail
  }
}
