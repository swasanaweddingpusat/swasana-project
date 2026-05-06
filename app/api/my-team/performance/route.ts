import { getMyTeamPerformance } from "@/lib/queries/my-team";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`my-team-perf:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!groupId || !startDate || !endDate) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const performance = await getMyTeamPerformance(groupId, {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  return Response.json(performance);
}
