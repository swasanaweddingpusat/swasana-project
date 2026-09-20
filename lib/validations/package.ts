import { z } from "zod";

export const packageCategorySchema = z.enum(["WEDDINGS", "MICE"]);

export type PackageCategory = z.infer<typeof packageCategorySchema>;

export const createPackageSchema = z.object({
  packageName: z.string().min(1, "Nama paket wajib diisi"),
  category: packageCategorySchema.default("WEDDINGS"),
  available: z.boolean().default(true),
  venueId: z.string().nullable().optional(),
  packageTypeCategoryId: z.string().min(1, "Kategori paket wajib diisi").nullable().optional(),
  eventTypeId: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  termAndCondition: z.string().nullable().optional(),
  cancellationRefundPolicy: z.string().nullable().optional(),
  closingNote: z.string().nullable().optional(),
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

export const miceItemSchema = z.object({
  itemName: z.string().min(1, "Nama item wajib diisi"),
  itemDescription: z.string().default(""),
});

// ─── MICE Prices ("Harga" step — separate collection from miceItems) ─────────

export const micePriceTypeSchema = z.enum(["QTY", "NOMINAL"]);

export const micePriceSchema = z
  .object({
    name: z.string().min(1, "Nama item harga wajib diisi"),
    description: z.string().nullable().optional(),
    priceType: micePriceTypeSchema,
    qty: z.number().int().nullable().optional(),
    price: z.number().int().nullable().optional(),
    total: z.number().int().min(0, "Total tidak boleh negatif"),
  })
  .superRefine((data, ctx) => {
    if (data.priceType === "QTY") {
      if (data.qty === null || data.qty === undefined || data.qty < 1) {
        ctx.addIssue({ code: "custom", path: ["qty"], message: "Qty wajib diisi, minimal 1" });
      }
      if (data.price === null || data.price === undefined || data.price < 0) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Harga per unit wajib diisi" });
      }
    }
  });

// ─── Package Complimentary & Bonus (mirrors QuotationComplimentary/QuotationBonus) ──

export const packageComplimentarySchema = z.object({
  complimentaryId: z.string().optional().nullable(),
  name: z.string().min(1),
  price: z.coerce.number().int().min(0).default(0),
  isShowPrice: z.boolean().default(false),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

export const packageBonusSchema = z.object({
  bonusId: z.string().optional().nullable(),
  name: z.string().min(1),
  price: z.coerce.number().int().min(0).default(0),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

// ─── Package MICE Tax & Deposit (Step 2 sub-collection, optional — no min count) ──

export const packageTaxDepositSchema = z.object({
  name: z.string().min(1),
  nominal: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

// ─── MICE package save — create/edit + all sub-collections in ONE transaction ──

export const saveMicePackageSchema = z.object({
  id: z.string().optional(),
  packageName: z.string().min(1, "Nama paket wajib diisi"),
  available: z.boolean().default(true),
  venueId: z.string().nullable().optional(),
  eventTypeId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  termAndCondition: z.string().nullable().optional(),
  cancellationRefundPolicy: z.string().nullable().optional(),
  closingNote: z.string().nullable().optional(),
  items: z.array(miceItemSchema),
  taxDeposits: z.array(packageTaxDepositSchema),
  prices: z.array(micePriceSchema).min(1, "Minimal 1 item harga"),
  complimentaries: z.array(packageComplimentarySchema),
  bonuses: z.array(packageBonusSchema),
});

export type SaveMicePackageInput = z.infer<typeof saveMicePackageSchema>;

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type CreateVendorItemInput = z.infer<typeof createVendorItemSchema>;
export type CreateInternalItemInput = z.infer<typeof createInternalItemSchema>;
