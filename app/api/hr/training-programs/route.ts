import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getTrainingPrograms } from "@/lib/queries/hrDevelopment";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`training-programs:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getTrainingPrograms();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/training-programs]", error);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
