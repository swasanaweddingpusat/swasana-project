import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getKpiAwardCandidates } from "@/lib/queries/kpiInsentif";

// Cross-profile ranking data (totalBonus/netAmount of OTHER people) — restricted
// to roles that can already see aggregate/cross-profile KPI data, NOT the broader
// kpi-award:view (which every sales/manager also holds just to see award badges).
export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "kpi-master", action: "view" },
    { module: "kpi-simulation", action: "view" },
    { module: "kpi-report", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`kpi-award-candidates:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const awardId = searchParams.get("awardId");
  const periodRaw = searchParams.get("period");
  if (!awardId || !periodRaw) {
    return Response.json({ error: "awardId dan period wajib diisi" }, { status: 400 });
  }
  const period = new Date(periodRaw);

  const data = await getKpiAwardCandidates(awardId, period);
  return Response.json(data);
}
