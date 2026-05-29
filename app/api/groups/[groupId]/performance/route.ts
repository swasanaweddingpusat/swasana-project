import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupPerformance } from "@/lib/queries/groups";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`groups-detail-perf:${session.user.id}`)) return rateLimitResponse();

  const { groupId } = await params;

  const performance = await getGroupPerformance(groupId);
  return Response.json(performance);
}
