import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { isSuperAdmin } from "@/lib/permissions";
import { getTopSalesByRecentBookingRaw } from "@/lib/queries/salesPerformance";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiLimiter.check(`dashboard-sales-perf:${session.user.id}`)) {
    return rateLimitResponse();
  }

  const querySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  });

  const qParsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!qParsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const now = new Date();
  const year = qParsed.data.year ?? now.getFullYear();
  const monthParam = qParsed.data.month ?? now.getMonth() + 1;
  const month = monthParam - 1;
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const isAdmin = await isSuperAdmin(session.user.roleId);

  let allowedProfileIds: string[] | undefined;
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
    const ids = [...new Set(userGroups.flatMap((g) => g.members.map((m) => m.userId)))];
    allowedProfileIds = ids.length > 0 ? ids : [];
  }

  const data = await getTopSalesByRecentBookingRaw(startDate, endDate, allowedProfileIds);
  return Response.json(data);
}
