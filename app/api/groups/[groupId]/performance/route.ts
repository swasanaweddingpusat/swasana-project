import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupPerformance } from "@/lib/queries/groups";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`groups-detail-perf:${session.user.id}`)) return rateLimitResponse();

  const { groupId } = await params;
  const { searchParams } = new URL(request.url);

  const now = new Date();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const performance = await getGroupPerformance(groupId, startDate, endDate, year);
  return Response.json(performance);
}
