import type { BookingStatus, Prisma, WeddingSession } from "@prisma/client";
import { db } from "@/lib/db";

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

export async function isQuotationApproved(quotationId: string): Promise<boolean> {
  const approval = await db.approvalRecord.findUnique({
    where: { module_entityId: { module: "quotations", entityId: quotationId } },
    select: { status: true },
  });
  return approval?.status === "approved";
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
