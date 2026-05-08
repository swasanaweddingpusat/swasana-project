import { getMyTeamPerformance } from "@/lib/queries/my-team";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`my-team-perf:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  if (!groupId) return Response.json({ error: "Missing groupId" }, { status: 400 });

  const performance = await getMyTeamPerformance(groupId);
  return Response.json(performance);
}
