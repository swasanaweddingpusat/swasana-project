import { requirePermissionForRoute, hasPermission, isSuperAdmin } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupsWithPerformance } from "@/lib/queries/groups";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`groups-perf:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get("startDate");
  const endStr = searchParams.get("endDate");

  if (!startStr || !endStr) {
    return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  const isViewAll =
    (await isSuperAdmin(session.user.roleId)) ||
    (await hasPermission(session.user.roleId, "groups", "view-all"));

  const groups = await getGroupsWithPerformance(
    isViewAll ? undefined : session.user.profileId,
    startDate,
    endDate,
  );

  const totalSales = groups.reduce((s, g) => s + g.revenue, 0);
  const avgAchievement =
    groups.length > 0
      ? Math.round(groups.reduce((s, g) => s + g.avgAchievement, 0) / groups.length)
      : 0;
  const totalConfirmed = groups.reduce((s, g) => s + g.confirmedCount, 0);

  return Response.json({
    summary: { totalGroups: groups.length, totalSales, avgAchievement, totalConfirmed },
    groups,
  });
}
