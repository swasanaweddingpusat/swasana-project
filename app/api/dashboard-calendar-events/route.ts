import { requirePermissionForRoute, isSuperAdmin } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getDashboardCalendarEvents } from "@/lib/queries/calendar-events";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`dashboard-calendar-events:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  const profileId = session.user.profileId ?? undefined;
  const isAdmin = await isSuperAdmin(session.user.roleId);

  let dataScope: DataScope = "own";
  if (!isAdmin && profileId) {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { dataScope: true },
    });
    if (profile) dataScope = profile.dataScope as DataScope;
  } else if (isAdmin) {
    dataScope = "all";
  }

  const events = await getDashboardCalendarEvents(
    year,
    month,
    isAdmin ? undefined : profileId,
    dataScope,
  );

  return Response.json(events);
}
