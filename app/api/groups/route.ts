import { requirePermissionForRoute, hasPermission } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroups } from "@/lib/queries/groups";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "groups",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`groups-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const isAdmin = session.user.isSuperAdmin;
    const canViewAll = await hasPermission(session.user.roleId, "groups", "view-all");

    const userId = isAdmin || canViewAll ? undefined : session.user.id;
    const groups = await getGroups(1, 10, userId);
    return Response.json(groups);
  } catch {
    return Response.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}
