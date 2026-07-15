import { db } from "@/lib/db";
import {
  getTermPaidMap,
  getTermAllocationsForBookings,
  getBookingCashIns,
  deriveTermStatus,
  type BookingCashIn,
} from "@/lib/queries/ledger";
import { getActiveInvoiceMapForBookings } from "@/lib/queries/invoices";

export interface BookingFinanceDetail {
  id: string;
  customerName: string;
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
  margin: number;
  terms: {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    sortOrder: number;
    paymentStatus: "unpaid" | "paid" | "partial" | "refund";
    ackStatus: string | null;
    paymentEvidence: string | null;
    paymentMethodId: string | null;
    notes: string | null;
    /** Dual-source: max(Σ acked Ledger allocations, legacy paid amount). */
    effectivePaid: number;
    /** Derived status from effectivePaid — source of truth for UI display. */
    effectiveStatus: "paid" | "partial" | "overdue" | "not_due_yet";
    partialPayments: {
      id: string;
      amount: number;
      paidAt: string;
      evidence: string | null;
      notes: string | null;
    }[];
    /**
     * Invoice ENTITY aktif (status=issued) buat termin ini (FIX C). null = belum
     * ada invoice diterbitkan. Beda dari legacy `TermOfPayment.invoiceNumber`.
     */
    invoice: { number: string; type: string; status: string; issuedAt: string } | null;
  }[];
  /**
   * Semua cash-in booking (pending + acknowledged, non-void) — buat "Riwayat
   * Pembayaran" di editor. Beda dari terms[].partialPayments yang acked-only
   * (dipakai derivasi status termin). Pembayaran baru langsung tampil di sini
   * walau belum diverifikasi Finance.
   */
  cashIns: BookingCashIn[];
  categories: {
    id: string;
    categoryName: string;
    basePrice: number;
    sortOrder: number;
    isShow: boolean;
    isTakeout: boolean;
    takeoutNominal: number;
  }[] | null;
}

export async function getBookingFinanceDetail(
  bookingId: string,
): Promise<BookingFinanceDetail | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    // Single LATERAL JOIN — pulls snapCustomer, snapPackagePricing, termOfPayments
    // (+ nested partialPayments) and snapPackageCategoryPrices in one query instead
    // of a round-trip per relation. Hit every time the TOP drawer opens.
    relationLoadStrategy: "join",
    select: {
      id: true,
      discountName: true,
      discountAmount: true,
      snapCustomer: { select: { name: true } },
      snapPackagePricing: { select: { price: true, margin: true } },
      termOfPayments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          amount: true,
          dueDate: true,
          sortOrder: true,
          notes: true,
        },
      },
      snapPackageCategoryPrices: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          categoryName: true,
          basePrice: true,
          sortOrder: true,
          isShow: true,
          isTakeout: true,
          takeoutNominal: true,
        },
      },
    },
  });

  if (!booking) return null;

  // Pure-derived (Fase 5): terbayar = Σ alokasi Ledger cash-in ter-ack.
  // paidMap = jumlah; allocMap = detail riwayat (ganti PartialPayment).
  // invoiceMap (FIX C) = invoice ENTITY aktif per termin, bulk (bukan N+1).
  const [paidMap, allocMap, cashIns, invoiceMap] = await Promise.all([
    getTermPaidMap(bookingId),
    getTermAllocationsForBookings([bookingId]),
    getBookingCashIns(bookingId),
    getActiveInvoiceMapForBookings([bookingId]),
  ]);
  const now = new Date();

  return {
    id: booking.id,
    customerName: booking.snapCustomer?.name ?? "",
    packagePrice: Number(booking.snapPackagePricing?.price ?? 0),
    discountName: booking.discountName ?? null,
    discountAmount: Number(booking.discountAmount ?? 0),
    margin: booking.snapPackagePricing?.margin ?? 0,
    terms: booking.termOfPayments.map((t) => {
      const amount = Number(t.amount);
      const effectivePaid = Math.min(paidMap.get(t.id) ?? 0, amount);
      const effectiveStatus = deriveTermStatus(amount, effectivePaid, new Date(t.dueDate), now);

      // paymentStatus/ackStatus legacy sudah di-drop — turunkan dari status derived
      // biar konsumen (drawer TOP) tetap kompatibel tanpa refactor besar.
      const paymentStatus: "unpaid" | "paid" | "partial" | "refund" =
        effectiveStatus === "paid" ? "paid" : effectiveStatus === "partial" ? "partial" : "unpaid";

      const invoiceRow = invoiceMap.get(t.id);
      const invoice = invoiceRow
        ? {
            number: invoiceRow.invoiceNumber,
            type: invoiceRow.invoiceType,
            status: invoiceRow.status,
            issuedAt: invoiceRow.issuedAt,
          }
        : null;

      return {
        id: t.id,
        name: t.name,
        amount,
        dueDate: new Date(t.dueDate).toISOString(),
        sortOrder: t.sortOrder,
        paymentStatus,
        ackStatus: effectivePaid > 0 ? "acknowledged" : "pending",
        paymentEvidence: null,
        paymentMethodId: null,
        notes: t.notes ?? null,
        effectivePaid,
        effectiveStatus,
        // Riwayat pembayaran per termin sekarang dari Ledger allocation (bukan PartialPayment).
        partialPayments: (allocMap.get(t.id) ?? []).map((a) => ({
          id: a.id,
          amount: a.amount,
          paidAt: a.paidAt,
          evidence: null,
          notes: a.notes,
        })),
        invoice,
      };
    }),
    cashIns,
    categories:
      booking.snapPackageCategoryPrices.length > 0
        ? booking.snapPackageCategoryPrices.map((c) => ({
            id: c.id,
            categoryName: c.categoryName,
            basePrice: Number(c.basePrice),
            sortOrder: c.sortOrder,
            isShow: c.isShow,
            isTakeout: c.isTakeout,
            takeoutNominal: Number(c.takeoutNominal),
          }))
        : null,
  };
}
