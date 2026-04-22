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

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  // updateMany uses implicit transaction on Neon HTTP — fetch unread IDs then update one by one
  const unread = await db.notification.findMany({
    where: { userId, isRead: false },
    select: { id: true },
    take: 100,
  });
  for (const n of unread) {
    await db.notification.update({ where: { id: n.id }, data: { isRead: true } });
  }
}

export type NotificationItem = Awaited<ReturnType<typeof getNotifications>>[number];
