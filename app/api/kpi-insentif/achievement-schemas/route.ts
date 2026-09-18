import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter } from "@/lib/rate-limit";
import { getAchievementSchemas } from "@/lib/queries/kpiInsentif";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-master",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-achievement-schemas:${session!.user.id}`)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(req.url);
  const businessRole = url.searchParams.get("businessRole");
  const validRole =
    businessRole === "sales" || businessRole === "manager" ? businessRole : undefined;

  const schemas = await getAchievementSchemas(validRole);
  return Response.json(schemas);
}
