import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAssignments } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-assignment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-assignments:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);

  const profileId = searchParams.get("profileId") ?? undefined;
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
