import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

/** GET /api/bookings/[id]/terms
 *  Returns the stable { id, sortOrder } list for all terms of a booking (draft or saved).
 *  Used by the booking drawer to resolve termIds for evidence upload after a step-3 upsert.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`booking-terms:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;

  const terms = await db.termOfPayment.findMany({
    where: { bookingId: id },
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return Response.json(terms);
}
