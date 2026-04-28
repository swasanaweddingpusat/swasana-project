import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroups } from "@/lib/queries/groups";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`groups-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const groups = await getGroups();
    return Response.json(groups);
  } catch {
    return Response.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}
