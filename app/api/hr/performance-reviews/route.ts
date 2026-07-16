import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPerformanceReviews } from "@/lib/queries/hrPerformance";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`performance-reviews:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getPerformanceReviews();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/performance-reviews]", error);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
