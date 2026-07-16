import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getEmployeeCertifications } from "@/lib/queries/hrDevelopment";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`employee-certifications:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getEmployeeCertifications();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/employee-certifications]", error);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
