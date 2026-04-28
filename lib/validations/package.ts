import { z } from "zod";

export const createPackageSchema = z.object({
  packageName: z.string().min(1, "Nama paket wajib diisi"),
  available: z.boolean().default(true),
  venueId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();

export const createVariantSchema = z.object({
  packageId: z.string().min(1),
  variantName: z.string().min(1, "Nama variant wajib diisi"),
  pax: z.number().int().positive("PAX harus lebih dari 0"),
  price: z.number().int().nonnegative("Harga tidak boleh negatif"),
  available: z.boolean().default(true),
});

// For database: remove price since it's stored separately
export const dbCreateVariantSchema = createVariantSchema.omit({ price: true });
export const dbUpdateVariantSchema = dbCreateVariantSchema.partial();

export const updateVariantSchema = createVariantSchema.omit({ packageId: true }).partial();

export const createVendorItemSchema = z.object({
  packageVariantId: z.string().min(1),
  categoryName: z.string().min(1, "Nama kategori wajib diisi"),
  itemText: z.string().min(1, "Teks item wajib diisi"),
});

export const createInternalItemSchema = z.object({
  packageVariantId: z.string().min(1),
  itemName: z.string().min(1, "Nama item wajib diisi"),
  itemDescription: z.string().default(""),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type CreateVendorItemInput = z.infer<typeof createVendorItemSchema>;
export type CreateInternalItemInput = z.infer<typeof createInternalItemSchema>;
