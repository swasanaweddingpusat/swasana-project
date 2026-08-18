import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getOnboardingFormLinks } from "@/lib/queries/onboardingFormLinks";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`onboarding-form-links:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getOnboardingFormLinks();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/onboarding-form-links]", error);
    return Response.json({ error: "Failed to fetch onboarding form links" }, { status: 500 });
  }
}
