import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getBookingStatsRaw, resolveDealingRange } from "@/lib/queries/dashboard";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiLimiter.check(`dashboard-stats:${session.user.id}`)) {
    return rateLimitResponse();
  }

  // Dealing-date (createdAt) range — absent params → no range (all-time), see
  // resolveDealingRange().
  const querySchema = z.object({
    dealFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dealTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  const qParsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!qParsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { range } = resolveDealingRange(qParsed.data.dealFrom, qParsed.data.dealTo);

  // isSuperAdmin is already on the JWT (session.user) — no DB round-trip.
  const isAdmin = session.user.isSuperAdmin;

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

  const stats = await getBookingStatsRaw(salesIds, range);
  return Response.json(stats);
}
