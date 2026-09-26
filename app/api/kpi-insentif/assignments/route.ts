import { requireAnyPermissionForRoute, hasPermission } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAssignments } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  // kpi-assignment:view = manage/view any assignment (manager, HR, direktur-sales).
  // kpi-insentif:view = self-view only (Sales, Sales MICE see their own "KPI Saya" data).
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "kpi-assignment", action: "view" },
    { module: "kpi-insentif", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`kpi-assignments:${session.user.id}`)) return rateLimitResponse();

  const canViewAny = await hasPermission(
    session.user.roleId,
    "kpi-assignment",
    "view",
    session.user.isSuperAdmin
  );

  const { searchParams } = new URL(req.url);

  // Self-view-only callers cannot pass an arbitrary profileId — force-scope to
  // their own profile so kpi-insentif:view can never be used to read someone
  // else's assignments.
  const profileId = canViewAny
    ? (searchParams.get("profileId") ?? undefined)
    : session.user.profileId;
  if (!profileId) return Response.json([]);
  const periodRaw = searchParams.get("period");
  const period = periodRaw ? new Date(periodRaw) : undefined;
  const kpiMasterId = searchParams.get("kpiMasterId") ?? undefined;
  const venueId = searchParams.get("venueId") ?? undefined;
  const isDraftRaw = searchParams.get("isDraft");
  const isDraft =
    isDraftRaw === "true" ? true : isDraftRaw === "false" ? false : undefined;

  const data = await getAssignments({ profileId, period, kpiMasterId, venueId, isDraft });
  return Response.json(data);
}
