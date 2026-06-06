import { z } from "zod";

export const quotationTemplateItemSchema = z.object({
  title: z.string().min(1, "Judul item wajib diisi"),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).default(0),
  manualTotal: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export const upsertQuotationTemplateSchema = z.object({
  venueId: z.string().min(1, "Venue wajib dipilih"),
  paymentMethodId: z.string().optional().nullable(),
  items: z.array(quotationTemplateItemSchema).default([]),
});

export type UpsertQuotationTemplateInput = z.infer<typeof upsertQuotationTemplateSchema>;
export type QuotationTemplateItemInput = z.infer<typeof quotationTemplateItemSchema>;
