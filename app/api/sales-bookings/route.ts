import { getSalesBookings } from "@/lib/queries/groups";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`sales-bookings:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const salesId = searchParams.get("salesId");

  if (!salesId) return Response.json({ error: "Missing salesId" }, { status: 400 });

  const bookings = await getSalesBookings(salesId);
  return Response.json(bookings);
}
