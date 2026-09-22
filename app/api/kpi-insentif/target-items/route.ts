import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter } from "@/lib/rate-limit";
import { getTargetItems } from "@/lib/queries/kpiInsentif";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-master",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-target-items:${session!.user.id}`)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const items = await getTargetItems();
  return Response.json(items);
}
