import { z } from "zod";

/* ─── Create payable ─────────────────────────────────────────────────────────── */

export const createPayableSchema = z.object({
  bookingId: z.string().min(1, "Booking wajib dipilih"),
  type: z.enum(["program_cashback", "overpay_refund"]),
  amount: z.number().int().positive("Jumlah harus lebih dari 0"),
  programId: z.string().min(1).nullable().optional(),
  sourceLedgerId: z.string().min(1).nullable().optional(),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").nullable().optional(),
});

export type CreatePayableInput = z.infer<typeof createPayableSchema>;

/* ─── Disburse payable (mint Ledger direction=out) ───────────────────────────── */

export const disbursePayableSchema = z.object({
  payableId: z.string().min(1, "Payable ID tidak valid"),
  paymentMethodId: z.string().min(1, "Rekening tujuan wajib dipilih"),
  occurredAt: z.string().min(1, "Tanggal disbursement wajib diisi"),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").nullable().optional(),
});

export type DisbursePayableInput = z.infer<typeof disbursePayableSchema>;

/* ─── Void payable (outstanding only) ───────────────────────────────────────── */

export const voidPayableSchema = z.object({
  payableId: z.string().min(1, "Payable ID tidak valid"),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").nullable().optional(),
});

export type VoidPayableInput = z.infer<typeof voidPayableSchema>;
