import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { format, startOfMonth, endOfMonth } from "date-fns";

export type VenueAvailability = Record<string, { morning: boolean; evening: boolean; fullday: boolean }>;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`venue-availability:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  try {
    const base = monthParam ? new Date(`${monthParam}-01`) : new Date();
    const start = startOfMonth(base);
    const end = endOfMonth(base);

    const bookings = await db.booking.findMany({
      where: {
        venueId: id,
        bookingDate: { gte: start, lte: end },
        bookingStatus: { notIn: ["Canceled", "Lost"] },
      },
      select: { bookingDate: true, weddingSession: true },
    });

    // Init all dates in month as fully available
    const availability: VenueAvailability = {};
    const cur = new Date(start);
    while (cur <= end) {
      availability[format(cur, "yyyy-MM-dd")] = { morning: true, evening: true, fullday: true };
      cur.setDate(cur.getDate() + 1);
    }

    // Mark booked sessions
    for (const b of bookings) {
      const key = format(new Date(b.bookingDate), "yyyy-MM-dd");
      if (!availability[key]) continue;
      if (b.weddingSession === "morning") availability[key].morning = false;
      else if (b.weddingSession === "evening") availability[key].evening = false;
      else if (b.weddingSession === "fullday") {
        availability[key].morning = false;
        availability[key].evening = false;
        availability[key].fullday = false;
      }
      // If morning+evening both booked, fullday is also unavailable
      if (!availability[key].morning && !availability[key].evening) {
        availability[key].fullday = false;
      }
    }

    return Response.json(availability);
  } catch {
    return Response.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}
