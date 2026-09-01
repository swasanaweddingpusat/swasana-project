import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { canAccessBooking } from "@/lib/access-control";
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

  // Guard IDOR — caller wajib punya akses ke booking ini (data-scope). Tanpa ini
  // Sales scope "own" bisa baca detail keuangan booking milik siapa pun via ID.
  const scope = session.user.dataScope ?? "own";
  if (!(await canAccessBooking(session.user.profileId, scope, id))) {
    return NextResponse.json({ error: "Anda tidak memiliki akses ke booking ini." }, { status: 403 });
  }

  const detail = await getBookingFinanceDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Booking tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
