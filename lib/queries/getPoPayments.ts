import { db } from "@/lib/db";

/** View-model siap-render buat section "Summary Payment" PO PDF (dan reuse Invoice/Receipt nanti). */
export interface PoPaymentVM {
  label: string;
  amount: number;
  occurredAt: string;
  invoiceNumber: string | null;
}

/**
 * Payments di PO = event SETELAH snapshot freeze → SELALU live-fetch (tidak ikut
 * revisi). Cuma cash-in ber-flag `showInPo` & non-void. Pending pun tampil
 * (keputusan spec: toggle ON cukup). Diurut kronologis.
 *
 * Label pakai konteks BEKU di Ledger (FIX B — `snapTopName`/`snapPackageName`)
 * duluan; fallback live-join ke `allocations[0].term.name` cuma buat data lama
 * pre-migrasi (`snapTopName = null`) — zero regression. Kalau package saat cash-in
 * beda dari package booking sekarang (switch venue/paket), label dikasih penanda
 * `(nama package lama)` biar keliatan itu bayaran deal lama.
 */
export async function getPoPayments(bookingId: string): Promise<PoPaymentVM[]> {
  const [poLedgers, booking] = await Promise.all([
    db.ledger.findMany({
      where: { bookingId, direction: "in", showInPo: true, voidedAt: null },
      orderBy: { occurredAt: "asc" },
      take: 500,
      select: {
        amount: true,
        occurredAt: true,
        invoiceNumber: true,
        snapTopName: true,
        snapPackageName: true,
        paymentMethod: { select: { bankName: true, bankAccountNumber: true } },
        allocations: { select: { term: { select: { name: true } } }, take: 1 },
      },
    }),
    db.booking.findUnique({
      where: { id: bookingId },
      select: { snapPackagePricing: { select: { packageName: true } } },
    }),
  ]);

  const currentPackageName = booking?.snapPackagePricing?.packageName ?? null;

  return poLedgers.map((l) => {
    const base = l.snapTopName ?? l.allocations[0]?.term.name ?? "Pembayaran";
    const isStaleDeal = l.snapPackageName !== null && l.snapPackageName !== currentPackageName;
    const baseLabel = isStaleDeal ? `${base} (${l.snapPackageName})` : base;
    const bank = l.paymentMethod
      ? `${l.paymentMethod.bankName} (${l.paymentMethod.bankAccountNumber})`
      : "Tunai";
    const tgl = new Date(l.occurredAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    const label = `${baseLabel} - ${tgl} (${bank})`;

    return {
      label,
      amount: Number(l.amount),
      occurredAt: l.occurredAt.toISOString(),
      invoiceNumber: l.invoiceNumber ?? null,
    };
  });
}
