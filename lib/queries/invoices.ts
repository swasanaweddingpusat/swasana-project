import { db } from "@/lib/db";

/**
 * Invoice (tagihan terbit) — entity immutable terpisah dari TermOfPayment
 * (jadwal, live/mutable). Lihat FIX C, docs/superpowers/specs/2026-07-14-
 * booking-money-model.md §6.3.
 */
export interface InvoiceRow {
  id: string;
  bookingId: string;
  termId: string | null;
  invoiceNumber: string;
  invoiceType: string;
  amount: number;
  dueDate: string | null;
  notes: string | null;
  status: string;
  issuedAt: string;
  issuedById: string | null;
  voidedAt: string | null;
  voidedById: string | null;
}

function mapInvoiceRow(row: {
  id: string;
  bookingId: string;
  termId: string | null;
  invoiceNumber: string;
  invoiceType: string;
  amount: number;
  dueDate: Date | null;
  notes: string | null;
  status: string;
  issuedAt: Date;
  issuedById: string | null;
  voidedAt: Date | null;
  voidedById: string | null;
}): InvoiceRow {
  return {
    id: row.id,
    bookingId: row.bookingId,
    termId: row.termId,
    invoiceNumber: row.invoiceNumber,
    invoiceType: row.invoiceType,
    amount: Number(row.amount),
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    notes: row.notes,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    issuedById: row.issuedById,
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    voidedById: row.voidedById,
  };
}

const INVOICE_SELECT = {
  id: true,
  bookingId: true,
  termId: true,
  invoiceNumber: true,
  invoiceType: true,
  amount: true,
  dueDate: true,
  notes: true,
  status: true,
  issuedAt: true,
  issuedById: true,
  voidedAt: true,
  voidedById: true,
} as const;

/**
 * Semua invoice (issued + void) milik satu booking, urut terbit. Dipakai buat
 * "Riwayat Invoice" di AR detail drawer / invoice preview.
 */
export async function getInvoicesForBooking(bookingId: string): Promise<InvoiceRow[]> {
  const rows = await db.invoice.findMany({
    where: { bookingId },
    orderBy: { issuedAt: "asc" },
    take: 200, // hard cap — AGENTS.md: findMany tanpa pagination dilarang
    select: INVOICE_SELECT,
  });
  return rows.map(mapInvoiceRow);
}

/**
 * Invoice AKTIF (status=issued) buat 1 termin, atau null kalau belum ada /
 * udah di-void semua. Dipakai buat badge status invoice per-baris termin
 * (AR listing, TOP drawer) — guard "1 termin 1 invoice aktif" juga baca ini.
 */
export async function getInvoiceForTerm(termId: string): Promise<InvoiceRow | null> {
  const row = await db.invoice.findFirst({
    where: { termId, status: "issued" },
    orderBy: { issuedAt: "desc" },
    select: INVOICE_SELECT,
  });
  return row ? mapInvoiceRow(row) : null;
}

/**
 * Bulk: invoice AKTIF (status=issued) per termin, untuk sekumpulan booking —
 * SATU findMany buat semua booking (bukan N query per termin). Dipakai integrasi
 * AR listing (`lib/queries/ar.ts`) & detail (`lib/queries/booking-finance-detail.ts`)
 * biar tiap termin bisa nunjukin status invoice tanpa N+1.
 *
 * Return `Map<termId, InvoiceRow>`. Termin tanpa invoice aktif tidak muncul di map.
 */
export async function getActiveInvoiceMapForBookings(
  bookingIds: string[],
): Promise<Map<string, InvoiceRow>> {
  if (bookingIds.length === 0) return new Map();

  const rows = await db.invoice.findMany({
    where: { bookingId: { in: bookingIds }, status: "issued", termId: { not: null } },
    take: 2000, // hard cap — AR listing di-cap 500 booking, ini cukup lega
    select: INVOICE_SELECT,
  });

  const map = new Map<string, InvoiceRow>();
  for (const row of rows) {
    if (row.termId) map.set(row.termId, mapInvoiceRow(row));
  }
  return map;
}
