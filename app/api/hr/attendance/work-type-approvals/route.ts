import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getPendingWorkTypeApprovals } from "@/lib/queries/attendance";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr-attendance", action: "approve" });
  if (response) return response;

  if (!apiLimiter.check(`work-type-approvals-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getPendingWorkTypeApprovals();
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch work type approvals" }, { status: 500 });
  }
}
