import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAllModules } from "@/lib/queries/modules";

/**
 * Full module registry (active + inactive) for the settings/modules admin page.
 * Gated on `settings-role-permission` — same authority as roles. The public
 * sidebar switcher uses /api/modules (permission-filtered) instead.
 */
export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-role-permission",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`modules-all:${session.user.id}`)) return rateLimitResponse();

  const modules = await getAllModules();
  return Response.json(modules);
}
