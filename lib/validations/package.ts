import { z } from "zod";

export const packageCategorySchema = z.enum(["WEDDINGS", "MICE"]);

export type PackageCategory = z.infer<typeof packageCategorySchema>;

export const createPackageSchema = z.object({
  packageName: z.string().min(1, "Nama paket wajib diisi"),
  category: packageCategorySchema.default("WEDDINGS"),
  available: z.boolean().default(true),
  venueId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  pax: z.number().int().min(0).default(0),
  signature: z.string().nullable().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();

export const updateBookingCategoryPricesSchema = z.object({
  bookingId: z.string().min(1),
  categories: z
    .array(
      z.object({
        categoryId: z.string().nullable().optional(),
        categoryName: z.string().min(1),
        basePrice: z.number().int().min(0),
        sortOrder: z.number().int(),
        isShow: z.boolean(),
      }),
    )
    .min(1),
  margin: z.number().min(0),
  sellingPrice: z.number().int().min(0),
});

export const createVendorItemSchema = z.object({
  packageId: z.string().min(1),
  categoryName: z.string().min(1, "Nama kategori wajib diisi"),
  itemText: z.string().min(1, "Teks item wajib diisi"),
});

export const createInternalItemSchema = z.object({
  packageId: z.string().min(1),
  itemName: z.string().min(1, "Nama item wajib diisi"),
  itemDescription: z.string().default(""),
});

export const miceItemPriceTypeSchema = z.enum(["PAX", "NOMINAL"]);

export const miceItemSchema = z.object({
  itemName: z.string().min(1, "Nama item wajib diisi"),
  itemDescription: z.string().default(""),
  itemType: miceItemPriceTypeSchema.default("PAX"),
  itemPrice: z.number().int().min(0).default(0),
});

export const saveMiceItemsSchema = z.array(miceItemSchema);

export type MiceItemPriceType = z.infer<typeof miceItemPriceTypeSchema>;
export type MiceItemInput = z.infer<typeof miceItemSchema>;
export type SaveMiceItemsInput = z.infer<typeof saveMiceItemsSchema>;

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type CreateVendorItemInput = z.infer<typeof createVendorItemSchema>;
export type CreateInternalItemInput = z.infer<typeof createInternalItemSchema>;
