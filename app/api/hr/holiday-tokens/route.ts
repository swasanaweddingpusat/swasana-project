import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAvailableHolidayTokens } from "@/lib/queries/publicHoliday";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "attendance",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`holiday-tokens:${session.user.id}`)) return rateLimitResponse();

  const profileId = session.user.profileId;
  if (!profileId) return Response.json({ error: "Profile tidak ditemukan" }, { status: 400 });

  try {
    const result = await getAvailableHolidayTokens(profileId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch holiday tokens" }, { status: 500 });
  }
}
