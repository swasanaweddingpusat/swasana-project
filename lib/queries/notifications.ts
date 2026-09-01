import { db } from "@/lib/db";

export async function getNotifications(userId: string, limit = 20) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

export async function getUnreadMentionCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, isMention: true, isRead: false },
  });
}

export async function markAsRead(notificationId: string, _userId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export type NotificationItem = Awaited<ReturnType<typeof getNotifications>>[number];
