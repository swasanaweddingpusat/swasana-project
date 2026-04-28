import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getManagerProfiles } from "@/lib/queries/users";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`managers-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getManagerProfiles();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch managers" }, { status: 500 });
  }
}
