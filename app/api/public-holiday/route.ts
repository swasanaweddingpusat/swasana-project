import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPublicHolidays } from "@/lib/queries/publicHoliday";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-public-holiday",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`public-holiday:${session.user.id}`)) return rateLimitResponse();

  try {
    const items = await getPublicHolidays();
    return Response.json(items);
  } catch {
    return Response.json({ error: "Gagal mengambil data hari libur" }, { status: 500 });
  }
}
