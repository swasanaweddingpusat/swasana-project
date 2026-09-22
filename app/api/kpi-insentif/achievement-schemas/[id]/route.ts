import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAchievementSchemaById } from "@/lib/queries/kpiInsentif";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-master",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-achievement-schema:${session!.user.id}`))
    return rateLimitResponse();

  const { id } = await params;
  const schema = await getAchievementSchemaById(id);
  if (!schema) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(schema);
}
