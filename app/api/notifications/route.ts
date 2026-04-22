import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "@/lib/queries/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`notif:${session.user.id}:${ip}`)) return rateLimitResponse();

  const notifications = await getNotifications(session.user.profileId);
  const unreadCount = await getUnreadCount(session.user.profileId);

  return Response.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`notif-read:${session.user.id}:${ip}`)) return rateLimitResponse();

  const body = await req.json();
  const { notificationId, markAll } = body as { notificationId?: string; markAll?: boolean };

  if (markAll) {
    await markAllAsRead(session.user.profileId);
  } else if (notificationId) {
    await markAsRead(notificationId, session.user.profileId);
  }

  return Response.json({ success: true });
}
