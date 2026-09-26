import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface EligibleMiceQuotation {
  id: string;
  quotationNo: string | null;
  clientName: string;
  clientPhone: string;
  instansi: string | null;
  venueId: string | null;
  venueName: string | null;
  eventTypeId: string | null;
  eventTypeName: string | null;
  eventDate: Date | null;
  eventEndDate: Date | null;
  time: string | null;
  notes: string | null;
  pax: number;
  packageName: string | null;
  totalPrice: number;
  salesId: string;
  salesName: string | null;
}

/** Approved, unconverted quotations available to the Booking MICE flow. */
export async function getEligibleMiceQuotations(
  search: string,
  salesIds?: string[],
  limit = 10,
): Promise<EligibleMiceQuotation[]> {
  if (salesIds?.length === 0) return [];
  const query = `%${search.trim()}%`;
  const salesFilter = salesIds
    ? Prisma.sql`AND q."salesId" IN (${Prisma.join(salesIds)})`
    : Prisma.empty;

  return db.$queryRaw<EligibleMiceQuotation[]>(Prisma.sql`
    SELECT
      q."id", q."quotationNo", q."clientName", q."clientPhone", q."instansi",
      q."venueId", q."venueName", q."eventTypeId", q."eventTypeName",
      q."eventDate", q."eventEndDate", q."time", q."notes", q."pax",
      q."packageName", q."totalPrice", q."salesId", p."fullName" AS "salesName"
    FROM "quotations" q
    INNER JOIN "approval_records" ar
      ON ar."module" = 'quotations'
      AND ar."entityId" = q."id"
      AND ar."status" = 'approved'
    INNER JOIN "profiles" p ON p."id" = q."salesId"
    LEFT JOIN "bookings" b ON b."quotationId" = q."id"
    WHERE b."id" IS NULL
      AND (
        q."clientName" ILIKE ${query}
        OR q."clientPhone" ILIKE ${query}
        OR COALESCE(q."instansi", '') ILIKE ${query}
        OR COALESCE(q."quotationNo", '') ILIKE ${query}
      )
      ${salesFilter}
    ORDER BY q."createdAt" DESC
    LIMIT ${Math.min(50, Math.max(1, limit))}
  `);
}
