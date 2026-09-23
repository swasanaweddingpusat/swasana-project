import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCalculationResults } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-simulation",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-results:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);

  const profileId = searchParams.get("profileId") ?? undefined;
  const periodRaw = searchParams.get("period");
  const period = periodRaw ? new Date(periodRaw) : undefined;
  const status = searchParams.get("status") ?? undefined;
  const venueId = searchParams.get("venueId") ?? undefined;

  const data = await getCalculationResults({ profileId, period, status, venueId });
  return Response.json(data);
}
