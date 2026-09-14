import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`daily-activity-segments:${session.user.id}`)) return rateLimitResponse();

  const items = await db.dailyActivitySegment.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
  return Response.json(items);
}
