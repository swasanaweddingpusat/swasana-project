import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getHolidayTokenGrants } from "@/lib/queries/publicHoliday";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr-leave", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`holiday-token-grants-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const search = searchParams.get("search") ?? undefined;

  try {
    const result = await getHolidayTokenGrants({
      page: pageParam ? parseInt(pageParam, 10) : undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
      search,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch holiday token grants" }, { status: 500 });
  }
}
