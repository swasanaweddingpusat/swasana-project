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
  const startStr = searchParams.get("startDate");
  const endStr = searchParams.get("endDate");

  if (!startStr || !endStr) {
    return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
  }

  const performance = await getGroupPerformance(groupId, new Date(startStr), new Date(endStr));
  return Response.json(performance);
}
