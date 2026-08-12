import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCandidateSubmissions } from "@/lib/queries/candidateSubmissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`candidate-submissions:${session.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const submissions = await getCandidateSubmissions(id);
    return Response.json(submissions);
  } catch (error) {
    console.error("[GET /api/hr/recruitment-requests/[id]/submissions]", error);
    return Response.json({ error: "Failed to fetch candidate submissions" }, { status: 500 });
  }
}
