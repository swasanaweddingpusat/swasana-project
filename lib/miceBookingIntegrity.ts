import type { BookingStatus, Prisma, WeddingSession } from "@prisma/client";
import { db } from "@/lib/db";
import { getQuotationConversionReadinessError } from "@/lib/quotationReadiness";

interface MiceSlotInput {
  venueId: string;
  eventDate: Date;
  eventEndDate?: Date | null;
  session?: WeddingSession | null;
  excludeBookingId?: string;
}

/**
 * Returns true when an active saved booking already occupies the requested MICE
 * slot. Quotation conversions have no normalized session, so they conservatively
 * reserve their complete date range. Manual bookings with a session retain the
 * existing morning/evening sharing rules.
 */
export async function hasMiceSlotConflict(input: MiceSlotInput): Promise<boolean> {
  const inactiveStatuses: BookingStatus[] = ["Canceled", "Lost", "Rejected"];
  const baseWhere: Prisma.BookingWhereInput = {
    ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
    venueId: input.venueId,
    recordStatus: "saved",
    bookingStatus: { notIn: inactiveStatuses },
  };

  if (input.session && !input.eventEndDate) {
    const sessions: WeddingSession[] = input.session === "fullday"
      ? ["morning", "evening", "fullday"]
      : [input.session, "fullday"];
    const conflict = await db.booking.findFirst({
      where: {
        ...baseWhere,
        eventDate: input.eventDate,
        OR: [
          { weddingSession: { in: sessions } },
          // Quotation conversions have no normalized session and reserve the
          // complete day, so a session-based manual booking must still see them.
          { weddingSession: null },
        ],
      },
      select: { id: true },
    });
    return Boolean(conflict);
  }

  const rangeEnd = input.eventEndDate ?? input.eventDate;
  const conflict = await db.booking.findFirst({
    where: {
      ...baseWhere,
      eventDate: { lte: rangeEnd },
      OR: [
        { eventEndDate: { gte: input.eventDate } },
        { eventEndDate: null, eventDate: { gte: input.eventDate } },
      ],
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

/**
 * True when a quotation is complete enough to become a Booking MICE.
 *
 * This used to read an ApprovalRecord with module "quotations". No code path in
 * the app ever created such a record (quotations have no approval UI or action —
 * only `booking-mice`, `booking`, `package`, `catering` and `decoration` records
 * are ever written), so the check was unconditionally false and silently killed
 * every conversion that went through booking-mice. The guard is now the same
 * document-readiness contract the quotation module already enforces on its own
 * convert path, via getQuotationConversionReadinessError.
 *
 * Name kept as-is: the call sites live in actions/booking-mice*.ts.
 */
export async function isQuotationApproved(quotationId: string): Promise<boolean> {
  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
    select: {
      venueId: true,
      eventTypeId: true,
      eventDate: true,
      packageSource: true,
      packageId: true,
      subtotal: true,
      signingLocation: true,
      signatureSales: true,
      terms: { select: { amount: true, dueDate: true } },
    },
  });
  if (!quotation) return false;
  return getQuotationConversionReadinessError(quotation) === null;
}

/** Resolve and ensure a quotation has not already produced another Booking MICE. */
export async function getUnconvertedQuotation(
  quotationId: string,
  excludeBookingId?: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
    select: { booking: { select: { id: true } } },
  });

  if (!quotation) return { valid: false, error: "Quotation tidak ditemukan." };
  if (quotation.booking && quotation.booking.id !== excludeBookingId) {
    return { valid: false, error: "Quotation ini sudah terhubung ke booking lain." };
  }
  return { valid: true };
}
