import webpush from "web-push";
import { db } from "@/lib/db";

const vapidConfigured =
  !!process.env.VAPID_SUBJECT &&
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured) return;
  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId, isActive: true },
      select: { id: true, endpoint: true, authKey: true, p256dhKey: true },
    });

    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.authKey, p256dh: sub.p256dhKey },
          },
          body,
        ),
      ),
    );

    const staleIds: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        const statusCode =
          result.reason instanceof webpush.WebPushError
            ? result.reason.statusCode
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscriptions[i].id);
        }
      }
    }

    if (staleIds.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { id: { in: staleIds } },
      });
    }
  } catch {
    // Silent fail — push must never block business logic
  }
}

export function getNotificationUrl(type: string, entityId?: string | null): string {
  if (type === "leave_approved" || type === "leave_rejected") {
    return "/hrd/sistem-cuti";
  }
  if (type === "payslip_generated") {
    return "/hrd/slip-gaji";
  }
  if (type.startsWith("booking_")) {
    return "/booking/booking-weddings";
  }
  if (type === "comment_mention" && entityId) {
    return `/booking/booking-weddings?bookingId=${entityId}&openComments=true`;
  }
  return "/general/notifications";
}
