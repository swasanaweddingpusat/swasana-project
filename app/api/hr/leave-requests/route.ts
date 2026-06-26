import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getLeaveRequests } from "@/lib/queries/leaveRequests";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr-leave", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`leave-requests-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const profileId = searchParams.get("profileId") ?? undefined;

  try {
    const result = await getLeaveRequests({ status, departmentId, profileId });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch leave requests" }, { status: 500 });
  }
}
