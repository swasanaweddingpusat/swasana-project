import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCommissionPolicies } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-master",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-commission-policies:${session!.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const businessRole = searchParams.get("businessRole") as "sales" | "manager" | null;

  const data = await getCommissionPolicies(businessRole ?? undefined);
  return Response.json(data);
}
