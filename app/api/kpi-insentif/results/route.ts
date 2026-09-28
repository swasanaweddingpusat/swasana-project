import { requireAnyPermissionForRoute, hasPermission } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCalculationResults } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  // kpi-simulation:view / kpi-report:view = manager/HR viewing any employee's
  // results (simulation or finalized report).
  // kpi-insentif:view = self-view only (Sales, Sales MICE see their own
  // "KPI Saya" results).
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "kpi-simulation", action: "view" },
    { module: "kpi-report", action: "view" },
    { module: "kpi-insentif", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`kpi-results:${session.user.id}`)) return rateLimitResponse();

  const canViewAny =
    (await hasPermission(session.user.roleId, "kpi-simulation", "view", session.user.isSuperAdmin)) ||
    (await hasPermission(session.user.roleId, "kpi-report", "view", session.user.isSuperAdmin));

  const { searchParams } = new URL(req.url);

  // Self-view-only callers cannot pass an arbitrary profileId — force-scope to
  // their own profile so kpi-insentif:view can never be used to read someone
  // else's results.
  const profileId = canViewAny
    ? (searchParams.get("profileId") ?? undefined)
    : session.user.profileId;
  if (!profileId) return Response.json([]);
  const periodRaw = searchParams.get("period");
  const period = periodRaw ? new Date(periodRaw) : undefined;
  const status = searchParams.get("status") ?? undefined;
  const venueId = searchParams.get("venueId") ?? undefined;

  const data = await getCalculationResults({ profileId, period, status, venueId });
  return Response.json(data);
}
