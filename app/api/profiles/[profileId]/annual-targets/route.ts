import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMemberAnnualTargets } from "@/lib/queries/groups";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`profile-targets:${session.user.id}`)) return rateLimitResponse();

  const { profileId } = await params;
  const targets = await getMemberAnnualTargets(profileId);
  return Response.json(targets);
}
