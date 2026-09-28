// FILE: app/api/kpi-insentif/profiles/route.ts

import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getProfilesForKpiAssignment } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-assignment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-profiles:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const businessRoleRaw = searchParams.get("businessRole");
  const businessRole =
    businessRoleRaw === "sales" || businessRoleRaw === "manager" ? businessRoleRaw : undefined;

  const profiles = await getProfilesForKpiAssignment(businessRole);

  const result = profiles.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    roleName: p.roleName || null,
    venueId: null as string | null,
    venueName: null as string | null,
  }));

  return Response.json(result);
}
