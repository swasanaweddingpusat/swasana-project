import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import {
  getTermPaidMapForBookings,
  getTermAllocationsForBookings,
  deriveTermStatus,
} from "@/lib/queries/ledger";
import { getActiveInvoiceMapForBookings } from "@/lib/queries/invoices";
import type { ARBooking, ARInvoiceStatus, ARPartialPayment, ARTermin, ARTerminStatus } from "@/types/finance";

function deriveBookingStatus(termins: ARTermin[]): ARTerminStatus {
  if (termins.every((t) => t.status === "paid")) return "paid";
  if (termins.some((t) => t.status === "overdue")) return "overdue";
  if (termins.some((t) => t.status === "partial")) return "partial";
  if (termins.some((t) => t.status === "unpaid")) return "unpaid";
  return "not_due_yet";
}

export async function getARBookings(): Promise<{ data: ARBooking[]; total: number }> {
  "use cache";
  cacheTag("ar-bookings");
  cacheLife("minutes");

  const now = new Date();

  const where = {
    recordStatus: "saved" as const,
    termOfPayments: { some: {} },
  };

  // Hard cap: AR listing tidak boleh tak terbatas (AGENTS.md: findMany without pagination is forbidden)
  const bookings = await db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      poNumber: true,
      eventDate: true,
      bookingStatus: true,
      salesId: true,
      venueId: true,
      sales: { select: { fullName: true, nickName: true } },
      snapCustomer: { select: { name: true, emailCpp: true, emailCpw: true, mobileNumber: true } },
      snapVenue: { select: { venueName: true, venueId: true, brandName: true } },
      snapPackage: { select: { packageName: true } },
      termOfPayments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          amount: true,
          dueDate: true,
          notes: true,
        },
      },
    },
  });

  // Pure-derived (Fase 5): "terbayar" per termin = Σ alokasi Ledger cash-in ter-ack.
  // paidMap = jumlah gross; allocMap = detail riwayat (ganti tabel PartialPayment).
  // invoiceMap (FIX C) = invoice ENTITY aktif per termin — satu bulk query, bukan N+1.
  const bookingIds = bookings.map((b) => b.id);
  const [paidMap, allocMap, invoiceMap] = await Promise.all([
    getTermPaidMapForBookings(bookingIds),
    getTermAllocationsForBookings(bookingIds),
    getActiveInvoiceMapForBookings(bookingIds),
  ]);

  const mapped = bookings.map((b) => {
    const termins: ARTermin[] = b.termOfPayments.map((t) => {
      // Pure-derived: terbayar = Σ alokasi Ledger cash-in ter-ack (voidedAt=null).
      const derivedPaid = paidMap.get(t.id) ?? 0;

      const status = deriveTermStatus(Number(t.amount), derivedPaid, t.dueDate, now);
      const agingDays =
        status === "overdue"
          ? Math.floor((now.getTime() - t.dueDate.getTime()) / 86_400_000)
          : null;

      // Riwayat pembayaran termin sekarang dari Ledger (bukan PartialPayment).
      const partialPayments: ARPartialPayment[] = (allocMap.get(t.id) ?? []).map((a) => ({
        id: a.id,
        amount: a.amount,
        paidAt: a.paidAt,
        notes: a.notes,
      }));

      const remaining = Math.max(0, Number(t.amount) - derivedPaid);

      // statusInvoice + noInvoice sekarang derived dari Invoice ENTITY (FIX C Step 3).
      // TermOfPayment.invoiceNumber sudah di-drop — jangan baca dari TOP lagi.
      const invoiceRow = invoiceMap.get(t.id);
      const invoice = invoiceRow
        ? {
            id: invoiceRow.id,
            number: invoiceRow.invoiceNumber,
            type: invoiceRow.invoiceType,
            status: invoiceRow.status,
            issuedAt: invoiceRow.issuedAt,
          }
        : null;

      const statusInvoice: ARInvoiceStatus = invoiceRow
        ? status === "paid"
          ? "paid"
          : status === "partial"
            ? "partial"
            : "unpaid"
        : "unissued";

      return {
        id: t.id,
        name: t.name,
        dueDate: t.dueDate.toISOString(),
        amount: Number(t.amount),
        remaining,
        status,
        noInvoice: invoiceRow?.invoiceNumber ?? "",
        statusInvoice,
        agingDays,
        catatan: t.notes ?? "",
        partialPayments,
        // Ack sekarang per-Ledger cash-in. Di level termin: "acknowledged" = sudah
        // ada uang ter-ack yang menutup (derivedPaid>0). Metadata per-term (siapa/kapan
        // ack, bank tujuan) hidup di Ledger, tidak lagi di TOP → null.
        ackStatus: derivedPaid > 0 ? "acknowledged" : "pending",
        acknowledgedAt: null,
        acknowledgedByName: null,
        viaRekening: null,
        invoice,
      };
    });

    const totalPrice = termins.reduce((s, t) => s + t.amount, 0);
    const outstanding = termins
      .filter((t) => t.status !== "paid")
      .reduce((s, t) => s + t.remaining, 0);

    const nextDue = termins.find(
      (t) => t.status === "overdue" || t.status === "partial" || t.status === "unpaid"
    );
    const jatuhTempo =
      nextDue?.dueDate ??
      termins.find((t) => t.status === "not_due_yet")?.dueDate ??
      termins.at(-1)?.dueDate ??
      "";

    return {
      id: b.id,
      noPo: b.poNumber ?? "-",
      bookingStatus: b.bookingStatus,
      customerEvent: b.snapCustomer?.name ?? "-",
      customerEmail: b.snapCustomer?.emailCpp ?? b.snapCustomer?.emailCpw ?? "",
      customerPhone: b.snapCustomer?.mobileNumber ?? "",
      customerDate: b.eventDate!.toISOString(), // AR bookings are confirmed, always have eventDate
      namaEvent: b.snapVenue?.venueName ?? "-",
      brandName: b.snapVenue?.brandName ?? null,
      venueId: b.snapVenue?.venueId ?? b.venueId,
      salesId: b.salesId,
      salesPicName: b.sales?.fullName ?? b.sales?.nickName ?? "-",
      packageName: b.snapPackage?.packageName ?? null,
      totalPrice,
      outstanding,
      jatuhTempo,
      statusTermin: deriveBookingStatus(termins),
      termins,
    };
  });

  return { data: mapped, total: mapped.length };
}

export type ARBookingsResult = Awaited<ReturnType<typeof getARBookings>>;
