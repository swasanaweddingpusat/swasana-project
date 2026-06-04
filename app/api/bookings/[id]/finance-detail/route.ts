import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getBookingFinanceDetail } from "@/lib/queries/booking-finance-detail";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Allow booking:edit OR finance-ar:edit
  const bookingPerm = await requirePermissionForRoute({ module: "booking", action: "edit" });
  const arPerm = await requirePermissionForRoute({ module: "finance-ar", action: "edit" });

  if (bookingPerm.response && arPerm.response) {
    return bookingPerm.response;
  }

  const session = bookingPerm.session ?? arPerm.session;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!apiLimiter.check(`finance-detail:${session.user.id}`)) {
    return rateLimitResponse();
  }

  const { id } = await params;
  const detail = await getBookingFinanceDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Booking tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
