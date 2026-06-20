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
    // eventDate is stored as UTC midnight — the DB range query must also be UTC.
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

    // ── Source 1: Confirmed/active bookings ────────────────────────────────────
    // Availability is per-venue (1 venue = 1 physical space).
    // We intentionally do NOT filter by packageId —
    // any active booking at this venue blocks the slot, regardless of package.
    const bookings = await db.booking.findMany({
      where: {
        venueId: id,
        recordStatus: "saved",
        eventDate: { gte: start, lte: end },
        bookingStatus: { notIn: ["Canceled", "Lost", "Rejected"] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { eventDate: true, weddingSession: true },
    });

    // ── Source 2: Leads with isDateLocked = true ───────────────────────────────
    // A locked lead means booking fee has been received and the date+venue is
    // reserved for that prospective client. Both primary and secondary venue are
    // checked — either blocks the date.
    const lockedLeads = await db.lead.findMany({
      where: {
        isDateLocked: true,
        eventDate: { gte: start, lte: end },
        OR: [
          { venueId: id },
          { venueSecondaryId: id },
        ],
        // Exclude leads that have already been converted (won't block anymore)
        convertedAt: null,
        // Exclude soft-deleted leads
        deletedAt: null,
      },
      select: { eventDate: true, weddingSession: true },
    });

    // Also check eventDateAlt for locked leads — secondary date also blocks.
    const lockedLeadsAlt = await db.lead.findMany({
      where: {
        isDateLocked: true,
        eventDateAlt: { gte: start, lte: end, not: null },
        OR: [
          { venueId: id },
          { venueSecondaryId: id },
        ],
        convertedAt: null,
        // Exclude soft-deleted leads
        deletedAt: null,
      },
      select: { eventDateAlt: true, weddingSession: true },
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

    /**
     * Apply a booking/lead block to the availability map.
     * Weddings: morning / evening / fullday blocks corresponding slots.
     * MICE with session: block that session only.
     * MICE without session (legacy): conservative fullday block.
     */
    function applyBlock(
      dateKey: string,
      weddingSession: "morning" | "evening" | "fullday" | null,
    ) {
      if (!availability[dateKey]) return;
      if (weddingSession === "morning") {
        availability[dateKey].morning = false;
      } else if (weddingSession === "evening") {
        availability[dateKey].evening = false;
      } else if (weddingSession === "fullday") {
        availability[dateKey].morning = false;
        availability[dateKey].evening = false;
        availability[dateKey].fullday = false;
      } else {
        // weddingSession is null — legacy MICE or MICE without session recorded.
        // Conservative fallback: block entire day.
        availability[dateKey].morning = false;
        availability[dateKey].evening = false;
        availability[dateKey].fullday = false;
      }
      // If both morning and evening are blocked, fullday is also unavailable.
      if (!availability[dateKey].morning && !availability[dateKey].evening) {
        availability[dateKey].fullday = false;
      }
    }

    // Apply confirmed bookings
    for (const b of bookings) {
      const bd = b.eventDate!; // query filters eventDate: { gte, lte }, always non-null
      const key = `${bd.getUTCFullYear()}-${String(bd.getUTCMonth() + 1).padStart(2, "0")}-${String(bd.getUTCDate()).padStart(2, "0")}`;
      applyBlock(key, b.weddingSession);
    }

    // Apply locked leads (primary event date)
    for (const l of lockedLeads) {
      if (!l.eventDate) continue;
      const ld = l.eventDate;
      const key = `${ld.getUTCFullYear()}-${String(ld.getUTCMonth() + 1).padStart(2, "0")}-${String(ld.getUTCDate()).padStart(2, "0")}`;
      applyBlock(key, l.weddingSession);
    }

    // Apply locked leads (alternative event date)
    for (const l of lockedLeadsAlt) {
      if (!l.eventDateAlt) continue;
      const ld = l.eventDateAlt;
      const key = `${ld.getUTCFullYear()}-${String(ld.getUTCMonth() + 1).padStart(2, "0")}-${String(ld.getUTCDate()).padStart(2, "0")}`;
      applyBlock(key, l.weddingSession);
    }

    return Response.json(availability);
  } catch {
    return Response.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}
