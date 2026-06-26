import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getOnboardingAssignments } from "@/lib/queries/onboarding";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`onboarding-assignments-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  try {
    const result = await getOnboardingAssignments({ status });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch onboarding assignments" }, { status: 500 });
  }
}
