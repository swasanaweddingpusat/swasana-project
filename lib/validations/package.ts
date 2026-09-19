import { z } from "zod";

export const packageCategorySchema = z.enum(["WEDDINGS", "MICE"]);

export type PackageCategory = z.infer<typeof packageCategorySchema>;

export const createPackageSchema = z.object({
  packageName: z.string().min(1, "Nama paket wajib diisi"),
  category: packageCategorySchema.default("WEDDINGS"),
  available: z.boolean().default(true),
  venueId: z.string().nullable().optional(),
  packageTypeCategoryId: z.string().min(1, "Kategori paket wajib diisi"),
  paymentMethodId: z.string().nullable().optional(),
  termAndCondition: z.string().nullable().optional(),
  securityDeposit: z.coerce.number().int().min(0).default(0),
  cancellationRefundPolicy: z.string().nullable().optional(),
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

export const saveMiceItemsSchema = z.array(miceItemSchema);

export type MiceItemInput = z.infer<typeof miceItemSchema>;
export type SaveMiceItemsInput = z.infer<typeof saveMiceItemsSchema>;

// ─── MICE Prices ("Harga" step — separate collection from miceItems) ─────────

export const micePriceTypeSchema = z.enum(["QTY", "NOMINAL"]);

export const micePriceSchema = z
  .object({
    name: z.string().min(1, "Nama item harga wajib diisi"),
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

export const saveMicePricesSchema = z.array(micePriceSchema).min(1, "Minimal 1 item harga");

export type MicePriceType = z.infer<typeof micePriceTypeSchema>;
export type MicePriceInput = z.infer<typeof micePriceSchema>;
export type SaveMicePricesInput = z.infer<typeof saveMicePricesSchema>;

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

export const savePackageComplimentariesSchema = z.array(packageComplimentarySchema);
export const savePackageBonusesSchema = z.array(packageBonusSchema);

export type PackageComplimentaryInput = z.infer<typeof packageComplimentarySchema>;
export type PackageBonusInput = z.infer<typeof packageBonusSchema>;
export type SavePackageComplimentariesInput = z.infer<typeof savePackageComplimentariesSchema>;
export type SavePackageBonusesInput = z.infer<typeof savePackageBonusesSchema>;

// ─── Package MICE Tax & Deposit (Step 2 sub-collection, optional — no min count) ──

export const packageTaxDepositSchema = z.object({
  name: z.string().min(1),
  nominal: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

export const savePackageTaxDepositsSchema = z.array(packageTaxDepositSchema);

export type PackageTaxDepositInput = z.infer<typeof packageTaxDepositSchema>;
export type SavePackageTaxDepositsInput = z.infer<typeof savePackageTaxDepositsSchema>;

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type CreateVendorItemInput = z.infer<typeof createVendorItemSchema>;
export type CreateInternalItemInput = z.infer<typeof createInternalItemSchema>;
