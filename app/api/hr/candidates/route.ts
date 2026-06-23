import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCandidates } from "@/lib/queries/candidates";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`candidates-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const jobPostingId = searchParams.get("jobPostingId") ?? undefined;
  const stage = searchParams.get("stage") ?? undefined;

  try {
    const result = await getCandidates({ jobPostingId, stage });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}
