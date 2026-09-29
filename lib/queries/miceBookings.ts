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

/**
 * Conversion-ready, unconverted quotations available to the Booking MICE flow.
 *
 * Previously this INNER JOINed approval_records on module = 'quotations'. No code
 * path ever creates such a record, so the join matched nothing and the picker was
 * permanently empty. Eligibility is now the same readiness contract enforced by
 * lib/quotationReadiness.ts (getQuotationConversionReadinessError):
 *   - venue, event type and event date present
 *   - a package selected when packageSource is 'meeting-package'
 *   - subtotal > 0
 *   - signing location + sales signature present
 *   - at least one TOP, and every TOP has a positive amount and a due date
 * Plus the invariant that must never be relaxed: the quotation has no booking yet.
 */
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
    INNER JOIN "profiles" p ON p."id" = q."salesId"
    LEFT JOIN "bookings" b ON b."quotationId" = q."id"
    WHERE b."id" IS NULL
      AND q."venueId" IS NOT NULL
      AND q."eventTypeId" IS NOT NULL
      AND q."eventDate" IS NOT NULL
      AND (q."packageSource" IS DISTINCT FROM 'meeting-package' OR q."packageId" IS NOT NULL)
      AND q."subtotal" > 0
      AND COALESCE(TRIM(q."signingLocation"), '') <> ''
      AND COALESCE(TRIM(q."signatureSales"), '') <> ''
      AND EXISTS (
        SELECT 1 FROM "quotation_terms" t WHERE t."quotationId" = q."id"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "quotation_terms" t
        WHERE t."quotationId" = q."id"
          AND (t."amount" <= 0 OR t."dueDate" IS NULL)
      )
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
