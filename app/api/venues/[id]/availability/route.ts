import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export type VenueAvailability = Record<string, { morning: boolean; evening: boolean; fullday: boolean }>;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`venue-availability:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  try {
    // Build UTC-based start/end for the queried month.
    // monthParam = "YYYY-MM"; parse as UTC so the range is timezone-independent.
    // bookingDate is stored as UTC midnight — the DB range query must also be UTC.
    const year = monthParam
      ? parseInt(monthParam.split("-")[0] ?? "0", 10)
      : new Date().getUTCFullYear();
    const month = monthParam
      ? parseInt(monthParam.split("-")[1] ?? "1", 10)
      : new Date().getUTCMonth() + 1;
    // First day of month at UTC midnight
    const start = new Date(Date.UTC(year, month - 1, 1));
    // Last day: day 0 of next month = last day of this month
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const excludeId = searchParams.get("exclude"); // booking ID to exclude (for edit mode)

    // Availability is per-venue (1 venue = 1 physical space).
    // We intentionally do NOT filter by packageId —
    // any active booking at this venue blocks the slot, regardless of package.
    const bookings = await db.booking.findMany({
      where: {
        venueId: id,
        recordStatus: "saved",
        bookingDate: { gte: start, lte: end },
        bookingStatus: { notIn: ["Canceled", "Lost", "Rejected"] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { bookingDate: true, weddingSession: true },
    });

    // Init all dates in month as fully available.
    // Use UTC getters so the key is the same on any server timezone.
    const availability: VenueAvailability = {};
    const cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}`;
      availability[key] = { morning: true, evening: true, fullday: true };
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Mark booked sessions.
    // Weddings use morning / evening / fullday.
    // MICE: if weddingSession is set (morning/evening) → block that session only (granular).
    //       if weddingSession is null (legacy MICE without session) → block fullday (conservative fallback).
    for (const b of bookings) {
      // bookingDate is stored as UTC midnight — use UTC getters to derive the key
      // so it's consistent regardless of the server's local timezone.
      const bd = b.bookingDate;
      const key = `${bd.getUTCFullYear()}-${String(bd.getUTCMonth() + 1).padStart(2, "0")}-${String(bd.getUTCDate()).padStart(2, "0")}`;
      if (!availability[key]) continue;
      if (b.weddingSession === "morning") {
        availability[key].morning = false;
      } else if (b.weddingSession === "evening") {
        availability[key].evening = false;
      } else if (b.weddingSession === "fullday") {
        availability[key].morning = false;
        availability[key].evening = false;
        availability[key].fullday = false;
      } else {
        // weddingSession is null — legacy MICE booking (no session recorded).
        // Conservative fallback: block entire day so no new booking slips through
        // on a date that has an untracked MICE session.
        availability[key].morning = false;
        availability[key].evening = false;
        availability[key].fullday = false;
      }
      // If both morning and evening are blocked, fullday is also unavailable.
      if (!availability[key].morning && !availability[key].evening) {
        availability[key].fullday = false;
      }
    }

    return Response.json(availability);
  } catch {
    return Response.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}
