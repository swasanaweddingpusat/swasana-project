import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getOnboardingTemplates } from "@/lib/queries/onboarding";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`onboarding-templates-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getOnboardingTemplates();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch onboarding templates" }, { status: 500 });
  }
}
