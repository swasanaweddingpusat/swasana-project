import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getBookingActivityLogs, type BookingLogCategory } from "@/lib/queries/booking-log";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-booking-log",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`booking-logs:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));
  const search = searchParams.get("search")?.trim() || undefined;

  const rawCategory = searchParams.get("category");
  const category: BookingLogCategory | undefined =
    rawCategory === "WEDDINGS" || rawCategory === "MICE" ? rawCategory : undefined;

  const rawDateFrom = searchParams.get("dateFrom") ?? undefined;
  const rawDateTo = searchParams.get("dateTo") ?? undefined;
  const dateFrom = rawDateFrom && !Number.isNaN(Date.parse(rawDateFrom)) ? rawDateFrom : undefined;
  const dateTo = rawDateTo && !Number.isNaN(Date.parse(rawDateTo)) ? rawDateTo : undefined;

  const result = await getBookingActivityLogs({ page, pageSize, search, category, dateFrom, dateTo });

  return new Response(
    JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { headers: { "content-type": "application/json" } },
  );
}
