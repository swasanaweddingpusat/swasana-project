import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

/** GET /api/bookings/[id]/term-condition
 *  Returns { termAndCondition } from the booking's snapPackagePricing snapshot.
 *  Fetched on-demand when the TC drawer opens — NOT included in the list payload.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`booking-tc:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;

  const snap = await db.snapPackagePricing.findUnique({
    where: { bookingId: id },
    select: { termAndCondition: true },
  });

  return Response.json({ termAndCondition: snap?.termAndCondition ?? null });
}
