import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPermissions } from "@/lib/queries/permissions";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "role_permission", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`permissions:${session.user.id}`)) return rateLimitResponse();

  try {
    return Response.json(await getPermissions());
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
