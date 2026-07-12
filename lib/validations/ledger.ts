import { z } from "zod";

/**
 * Entry-drawer form schema — "Catat Transaksi".
 * Single source of truth for react-hook-form validation. `amount` is kept as a raw
 * string in the form (Rp thousand-separator input) and validated by digit content,
 * not by Number() blindly — so an empty / non-numeric value gives a friendly message.
 * On submit the drawer maps this to `CreateCashInInput` (actions/ledger.ts).
 */
export const ledgerEntrySchema = z.object({
  bookingId: z.string().min(1, "Client / booking wajib dipilih"),
  occurredAt: z.string().min(1, "Tanggal transaksi wajib diisi"),
  /** Raw string from the currency input, e.g. "30.000.000". */
  amount: z
    .string()
    .min(1, "Jumlah dibayar wajib diisi")
    .refine((v) => Number(v.replace(/[^\d]/g, "")) > 0, "Jumlah harus lebih dari 0"),
  /** FK PaymentMethod (rekening tujuan). */
  paymentMethodId: z.string().min(1, "Via rekening wajib dipilih"),
  /** "" = tanpa promo (pilihan sah — promo memang bisa tidak ada). */
  promoId: z.string().optional(),
  /** Termin (TOP) yang di-cover — wajib minimal satu. */
  linkedTerminIds: z.array(z.string()).min(1, "Pilih minimal satu termin"),
  /** Nama file bukti bayar — wajib. */
  paymentEvidenceName: z
    .string({ error: "Bukti bayar wajib diunggah" })
    .min(1, "Bukti bayar wajib diunggah"),
  notes: z
    .string()
    .min(1, "Keterangan wajib diisi")
    .max(500, "Keterangan maksimal 500 karakter"),
});

export type LedgerEntryFormValues = z.infer<typeof ledgerEntrySchema>;
