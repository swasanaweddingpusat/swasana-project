import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getExStaff } from "@/lib/queries/exStaff";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`ex-staff:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getExStaff();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/ex-staff]", error);
    return Response.json({ error: "Failed to fetch ex-staff" }, { status: 500 });
  }
}
