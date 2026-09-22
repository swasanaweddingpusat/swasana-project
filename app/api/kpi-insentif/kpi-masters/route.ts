import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter } from "@/lib/rate-limit";
import { getKpiMasters } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-master",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-masters:${session!.user.id}`)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(req.url);
  const businessRole = url.searchParams.get("businessRole") ?? undefined;
  const monthParam = url.searchParams.get("month") ?? undefined;

  let month: Date | undefined;
  if (monthParam) {
    const parts = monthParam.split("-");
    if (parts.length === 2) {
      month = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    }
  }

  const masters = await getKpiMasters({
    businessRole: businessRole === "sales" || businessRole === "manager" ? businessRole : undefined,
    month,
  });
  return Response.json(masters);
}
