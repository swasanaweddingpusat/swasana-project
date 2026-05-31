import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getSalesMiceProfiles } from "@/lib/queries/bookings";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking-mice", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`sales-mice:${session.user.id}`)) return rateLimitResponse();

  const data = await getSalesMiceProfiles();
  return Response.json(data);
}
