import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
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

  // Overview is company-wide: stats always cover ALL sales, regardless of the
  // viewer's dataScope. Dashboard-only — other endpoints stay scoped. `null` =
  // no salesId filter (whole database).
  const stats = await getBookingStatsRaw(null, range);
  return Response.json(stats);
}
