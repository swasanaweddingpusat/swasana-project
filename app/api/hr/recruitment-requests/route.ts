import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getRecruitmentRequests } from "@/lib/queries/recruitmentRequests";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`recruitment-requests:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getRecruitmentRequests();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/recruitment-requests]", error);
    return Response.json({ error: "Failed to fetch recruitment requests" }, { status: 500 });
  }
}
