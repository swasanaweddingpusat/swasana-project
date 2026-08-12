import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getBlacklistEntries } from "@/lib/queries/blacklistEntries";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`blacklist-entries-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getBlacklistEntries();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/hr/blacklist-entries]", error);
    return Response.json({ error: "Failed to fetch blacklist entries" }, { status: 500 });
  }
}
