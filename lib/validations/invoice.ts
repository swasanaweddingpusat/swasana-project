import { z } from "zod";

/**
 * "Terbitkan Invoice" — dipakai form client (react-hook-form) & server action
 * (`issueInvoice`, actions/invoice.ts). Invoice = on-demand, 1:1 (1 invoice =
 * 1 termin). Nomor invoice TIDAK di-generate di client — lahir di server saat
 * submit (gapless via `getNextSequence`), jadi schema ini gak punya field nomor.
 */
export const issueInvoiceSchema = z.object({
  termId: z.string().min(1, "Termin wajib dipilih"),
  invoiceType: z.enum(["dp", "progress", "pelunasan", "lainnya"], "Jenis invoice wajib dipilih"),
  dueDate: z.coerce.date().optional(),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
