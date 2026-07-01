import { z } from "zod";

// ─── Internal Items ───────────────────────────────────────────────────────────

export const snapInternalItemSchema = z.object({
  itemName: z.string().min(1, "Nama item wajib diisi").max(255, "Nama item maksimal 255 karakter"),
  itemDescription: z.string().max(1000, "Deskripsi maksimal 1000 karakter").default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const saveSnapInternalItemsSchema = z.object({
  bookingId: z.string().min(1, "Booking ID wajib diisi"),
  items: z.array(snapInternalItemSchema),
});

export type SnapInternalItemInput = z.infer<typeof snapInternalItemSchema>;
export type SaveSnapInternalItemsInput = z.infer<typeof saveSnapInternalItemsSchema>;

// ─── Vendor Items ─────────────────────────────────────────────────────────────

export const snapVendorItemSchema = z.object({
  categoryId: z.string().nullable().default(null),
  categoryName: z.string().min(1, "Nama kategori wajib diisi").max(255, "Nama kategori maksimal 255 karakter"),
  itemText: z.string().min(1, "Item text wajib diisi").max(1000, "Item text maksimal 1000 karakter"),
  sortOrder: z.number().int().min(0).default(0),
  isTakeout: z.boolean().default(false),
});

export const saveSnapVendorItemsSchema = z.object({
  bookingId: z.string().min(1, "Booking ID wajib diisi"),
  items: z.array(snapVendorItemSchema),
});

export type SnapVendorItemInput = z.infer<typeof snapVendorItemSchema>;
export type SaveSnapVendorItemsInput = z.infer<typeof saveSnapVendorItemsSchema>;

// ─── Complimentaries ──────────────────────────────────────────────────────────

export const snapComplimentaryItemSchema = z.object({
  complimentaryId: z.string().nullable().default(null),
  name: z.string().min(1, "Nama wajib diisi").max(255, "Nama maksimal 255 karakter"),
  price: z.number().int().min(0, "Harga tidak boleh negatif").default(0),
  isShowPrice: z.boolean().default(false),
  description: z.string().max(1000, "Deskripsi maksimal 1000 karakter").nullable().default(null),
  qty: z.number().int().min(1, "Qty minimal 1").default(1),
  sortOrder: z.number().int().min(0).default(0),
});

export const saveSnapComplimentariesSchema = z.object({
  bookingId: z.string().min(1, "Booking ID wajib diisi"),
  items: z.array(snapComplimentaryItemSchema),
});

export type SnapComplimentaryItemInput = z.infer<typeof snapComplimentaryItemSchema>;
export type SaveSnapComplimentariesInput = z.infer<typeof saveSnapComplimentariesSchema>;

// ─── Takeout ──────────────────────────────────────────────────────────────────

export const snapTakeoutItemSchema = z.object({
  categoryName: z.string().min(1, "Nama kategori wajib diisi").max(255),
  isTakeout: z.boolean(),
  takeoutNominal: z.number().int().min(0).default(0),
});

export const saveSnapTakeoutSchema = z.object({
  bookingId: z.string().min(1, "Booking ID wajib diisi"),
  items: z.array(snapTakeoutItemSchema).min(1, "Minimal satu item wajib dikirim"),
});

export type SnapTakeoutItemInput = z.infer<typeof snapTakeoutItemSchema>;
export type SaveSnapTakeoutInput = z.infer<typeof saveSnapTakeoutSchema>;
