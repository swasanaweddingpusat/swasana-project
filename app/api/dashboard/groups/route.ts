import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupAchievementRaw, resolveDealingRange, resolveEventRange } from "@/lib/queries/dashboard";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiLimiter.check(`dashboard-groups:${session.user.id}`)) {
    return rateLimitResponse();
  }

  // Dealing-date (createdAt) range — absent params → no range (all-time), see
  // resolveDealingRange(). Group revenue still uses the current-year target.
  const querySchema = z.object({
    dealFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dealTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    eventFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    eventTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  const qParsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!qParsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { range } = resolveDealingRange(qParsed.data.dealFrom, qParsed.data.dealTo);
  const { range: eventRange } = resolveEventRange(qParsed.data.eventFrom, qParsed.data.eventTo);

  // Overview is company-wide: group achievement always covers ALL groups,
  // regardless of the viewer's dataScope. Dashboard-only — other endpoints stay
  // scoped. `undefined` = every group.
  const groups = await getGroupAchievementRaw(undefined, range, eventRange);
  return Response.json(groups);
}
