import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAnnouncements } from "@/lib/queries/announcements";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "announcement",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`announcements-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getAnnouncements();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/announcements]", error);
    return Response.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}
