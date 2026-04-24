import { NextRequest } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/bookings/eligible-for-allocation?vendorId=xxx&excludeBookingId=xxx
export async function GET(req: NextRequest) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`eligible-allocation:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = req.nextUrl;
  const vendorId = searchParams.get("vendorId");
  const excludeBookingId = searchParams.get("excludeBookingId");

  if (!vendorId) return Response.json({ error: "vendorId required" }, { status: 400 });

  // Cari bookings yang punya vendor yang sama (bukan addons), exclude booking saat ini
  const items = await db.snapVendorItem.findMany({
    where: {
      vendorId,
      isAddons: false,
      bookingId: excludeBookingId ? { not: excludeBookingId } : undefined,
    },
    select: {
      id: true,
      bookingId: true,
      booking: {
        select: {
          id: true,
          snapCustomer: { select: { name: true } },
          bookingDate: true,
          snapVenue: { select: { venueName: true } },
        },
      },
    },
    orderBy: { booking: { bookingDate: "desc" } },
    take: 50,
  });

  const result = items.map((item) => ({
    id: item.bookingId,
    snapVendorItemId: item.id,
    label: `${item.booking.snapCustomer?.name ?? "-"} — ${item.booking.snapVenue?.venueName ?? "-"} (${new Date(item.booking.bookingDate).toLocaleDateString("id-ID")})`,
  }));

  return Response.json(result);
}
