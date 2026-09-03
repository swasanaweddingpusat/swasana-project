import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getDashboardCalendarEvents } from "@/lib/queries/calendar-events";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`dashboard-calendar-events:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  // Overview is company-wide: the mini-calendar shows ALL events, regardless of
  // the viewer's dataScope. Dashboard-only — the booking calendar
  // (/api/calendar-events) still enforces per-user dataScope.
  const events = await getDashboardCalendarEvents(year, month, undefined, "all");

  return Response.json(events);
}
