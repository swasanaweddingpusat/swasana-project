import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getKpis } from "@/lib/queries/hrPerformance";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`kpis:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getKpis();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/kpis]", error);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
