import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/permissions";
import { getBookingStatsRaw } from "@/lib/queries/dashboard";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`dashboard-stats:${session.user.id}:${ip}`)) {
    return rateLimitResponse();
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = searchParams.has("year")
    ? parseInt(searchParams.get("year")!, 10)
    : now.getFullYear();
  const monthParam = searchParams.has("month")
    ? parseInt(searchParams.get("month")!, 10)
    : now.getMonth() + 1;
  const month = monthParam - 1; // convert 1-indexed URL param to 0-indexed Date arg
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const isAdmin = await isSuperAdmin(session.user.roleId);

  let salesIds: string[] | null = null;
  if (!isAdmin) {
    const userGroups = await db.userGroup.findMany({
      where: {
        OR: [
          { leaderId: session.user.profileId },
          { members: { some: { userId: session.user.profileId } } },
        ],
      },
      select: { members: { select: { userId: true } } },
      take: 200,
    });
    const ids = [
      ...new Set(userGroups.flatMap((g) => g.members.map((m) => m.userId))),
    ];
    salesIds = ids.length > 0 ? ids : null;
  }

  const stats = await getBookingStatsRaw(salesIds, startDate, endDate);
  return Response.json(stats);
}
