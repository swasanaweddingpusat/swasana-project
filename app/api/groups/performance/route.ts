import { requirePermissionForRoute, hasPermission, isSuperAdmin } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupsWithPerformance } from "@/lib/queries/groups";

export async function GET(_request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`groups-perf:${session.user.id}`)) return rateLimitResponse();

  const isViewAll =
    (await isSuperAdmin(session.user.roleId)) ||
    (await hasPermission(session.user.roleId, "groups", "view-all"));

  const groups = await getGroupsWithPerformance(
    isViewAll ? undefined : session.user.profileId,
  );

  const totalSales = groups.reduce((s, g) => s + g.revenue, 0);
  const totalTarget = groups.reduce((s, g) => s + g.target, 0);
  const avgAchievement =
    groups.length > 0
      ? Math.round(groups.reduce((s, g) => s + g.avgAchievement, 0) / groups.length)
      : 0;
  const totalConfirmed = groups.reduce((s, g) => s + g.confirmedCount, 0);
  const totalPiutang = groups.reduce((s, g) => s + g.piutang, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.totalRevenue, 0);

  return Response.json({
    summary: {
      totalGroups: groups.length,
      totalSales,
      totalTarget,
      avgAchievement,
      totalConfirmed,
      totalPiutang,
      totalRevenue,
    },
    groups,
  });
}
