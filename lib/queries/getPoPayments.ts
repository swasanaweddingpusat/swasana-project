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
 * revisi). Granular PER-ALOKASI: cuma alokasi ber-flag `showInPo` dari cash-in
 * non-void yang tampil. Satu cash-in bisa menyumbang beberapa baris (satu per
 * termin yang di-toggle) atau tidak sama sekali. Pending pun tampil (toggle ON
 * cukup). Diurut kronologis (tanggal cash-in), lalu sortOrder termin.
 *
 * Label pakai nama termin dari alokasi (`allocation.term.name`) + tanggal + bank.
 * Kalau package saat cash-in beda dari package booking sekarang (switch venue/paket),
 * label dikasih penanda `(nama package lama)` dari `snapPackageName` biar keliatan
 * itu bayaran deal lama — zero regression untuk data pre-migrasi (`snapPackageName`
 * null → tanpa penanda).
 */
export async function getPoPayments(bookingId: string): Promise<PoPaymentVM[]> {
  const [poAllocations, booking] = await Promise.all([
    db.paymentAllocation.findMany({
      where: {
        showInPo: true,
        ledger: { bookingId, direction: "in", voidedAt: null },
      },
      take: 500,
      select: {
        amount: true,
        term: { select: { name: true, sortOrder: true } },
        ledger: {
          select: {
            occurredAt: true,
            invoiceNumber: true,
            snapPackageName: true,
            paymentMethod: { select: { bankName: true, bankAccountNumber: true } },
          },
        },
      },
    }),
    db.booking.findUnique({
      where: { id: bookingId },
      select: { snapPackagePricing: { select: { packageName: true } } },
    }),
  ]);

  const currentPackageName = booking?.snapPackagePricing?.packageName ?? null;

  return poAllocations
    .map((a) => {
      const l = a.ledger;
      const base = a.term?.name ?? "Pembayaran";
      const isStaleDeal =
        l.snapPackageName !== null && l.snapPackageName !== currentPackageName;
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
        amount: Number(a.amount),
        occurredAt: l.occurredAt.toISOString(),
        invoiceNumber: l.invoiceNumber ?? null,
        _sortOrder: a.term?.sortOrder ?? 0,
      };
    })
    // Kronologis (tanggal cash-in), tie-break sortOrder termin biar urutan stabil.
    .sort((x, y) => {
      const t = x.occurredAt.localeCompare(y.occurredAt);
      return t !== 0 ? t : x._sortOrder - y._sortOrder;
    })
    .map(({ _sortOrder, ...vm }) => vm);
}
