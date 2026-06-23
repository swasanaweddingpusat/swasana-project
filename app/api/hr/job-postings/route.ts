import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getJobPostings } from "@/lib/queries/jobPostings";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`job-postings-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getJobPostings();
    return Response.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/hr/job-postings] Error:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return Response.json(
      { error: "Failed to fetch job postings", details: errorMessage },
      { status: 500 }
    );
  }
}
