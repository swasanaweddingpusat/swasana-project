import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getApprovalFlows } from "@/lib/queries/approval-flows";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "settings", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`approval-flows:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getApprovalFlows();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch approval flows" }, { status: 500 });
  }
}
