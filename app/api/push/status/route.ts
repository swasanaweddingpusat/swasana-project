import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`push-status:${session.user.id}:${ip}`)) {
    return rateLimitResponse();
  }

  const count = await db.pushSubscription.count({
    where: { userId: session.user.profileId, isActive: true },
  });

  return Response.json({
    isSubscribed: count > 0,
    subscriptionCount: count,
  });
}
