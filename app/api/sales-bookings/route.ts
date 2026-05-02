import { getSalesBookings } from "@/lib/queries/my-team";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`sales-bookings:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const salesId = searchParams.get("salesId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!salesId || !startDate || !endDate) {
    return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });
  }

  const bookings = await getSalesBookings(salesId, {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  return new Response(JSON.stringify(bookings), {
    headers: { "content-type": "application/json" },
  });
}
