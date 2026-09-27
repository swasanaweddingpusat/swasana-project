import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAwardWinners } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-award",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-award-winners:${session!.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const awardId = searchParams.get("awardId") ?? undefined;
  const periodRaw = searchParams.get("period");
  const period = periodRaw ? new Date(periodRaw) : undefined;
  const profileId = searchParams.get("profileId") ?? undefined;

  const data = await getAwardWinners({ awardId, period, profileId });
  return Response.json(data);
}
