import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMyOnboardingAssignment } from "@/lib/queries/onboarding";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiLimiter.check(`my-onboarding:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getMyOnboardingAssignment(session.user.profileId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch my onboarding" }, { status: 500 });
  }
}
