import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getKpiAwards } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-award",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-awards:${session!.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const businessRole = searchParams.get("businessRole") as "sales" | "manager" | null;
  const isActiveRaw = searchParams.get("isActive");
  const isActive = isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : undefined;

  const data = await getKpiAwards({ businessRole: businessRole ?? undefined, isActive });
  return Response.json(data);
}
