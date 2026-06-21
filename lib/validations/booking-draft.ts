import { z } from "zod";

// ─── Step 1: Create Draft ─────────────────────────────────────────────────────

export const createDraftStep1Schema = z.object({
  /** Client-generated idempotency key. When provided, server uses it as the booking id
   *  so that retries don't create duplicate draft rows. */
  id: z.string().optional().nullable(),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().optional().nullable(),
  salesId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),

  // Customer identification — one of these paths must be provided:
  // (a) customerId — existing customer
  // (b) leadId — convert from lead
  // (c) customerName — new customer from manual input
  customerId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),

  // New customer fields (used when customerName is provided without customerId/leadId)
  customerName: z.string().optional(),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().optional().default(""),
  contactEmailCpw: z.string().optional().default(""),
  contactNikCpp: z.string().optional().default(""),
  contactNikCpw: z.string().optional().default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),

  // Time and note for the event date (step 1 UI fields)
  eventTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Step 1 also collects discount/bonus name (optional at this stage)
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
});

export type CreateDraftStep1Input = z.infer<typeof createDraftStep1Schema>;

// ─── Step 2: Package/Takeout data ────────────────────────────────────────────

export const updateDraftStep2Schema = z.object({
  packageId: z.string().optional().nullable(),
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
  categoryToggles: z
    .array(
      z.object({
        categoryName: z.string().min(1),
        isTakeout: z.boolean().default(false),
        takeoutNominal: z.coerce.number().int().min(0).default(0),
      })
    )
    .optional()
    .default([]),
  draftComplimentaries: z
    .array(
      z.object({
        complimentaryId: z.string().optional().nullable(),
        name: z.string().min(1),
        price: z.coerce.number().int().min(0).default(0),
        isShowPrice: z.boolean().default(false),
        description: z.string().optional().nullable(),
        qty: z.coerce.number().int().min(1).default(1),
      })
    )
    .optional()
    .default([]),
});

export type UpdateDraftStep2Input = z.infer<typeof updateDraftStep2Schema>;

// ─── Step 3: Term of Payments ─────────────────────────────────────────────────

export const updateDraftStep3Schema = z.object({
  paymentMethodId: z.string().optional().nullable(),
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
  termOfPayments: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.coerce.number().min(0),
        dueDate: z.string().min(1),
        sortOrder: z.coerce.number().int().default(0),
        paymentStatus: z
          .enum(["unpaid", "paid", "partial", "refund"])
          .default("unpaid"),
      })
    )
    .optional()
    .default([]),
});

export type UpdateDraftStep3Input = z.infer<typeof updateDraftStep3Schema>;

// ─── Step 4: Signature/location ───────────────────────────────────────────────

export const updateDraftStep4Schema = z.object({
  signingLocation: z.string().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
  withMaterai: z.boolean().default(false),
});

export type UpdateDraftStep4Input = z.infer<typeof updateDraftStep4Schema>;

// ─── Finalize: promote draft to saved booking ─────────────────────────────────

export const finalizeDraftSchema = z.object({
  draftId: z.string().min(1, "Draft ID wajib diisi"),

  // Final step 4 data (may override what's already saved on draft)
  signingLocation: z.string().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
  withMaterai: z.boolean().default(false),

  // Lead ID to stamp conversion tracking
  leadId: z.string().optional().nullable(),

  // Bonuses (legacy vendor-based) — kept for backward compat, booking-drawer no longer populates this
  bonuses: z
    .array(
      z.object({
        vendorId: z.string().min(1),
        vendorCategoryId: z.string().min(1),
        vendorName: z.string().min(1),
        description: z.string().optional().nullable(),
        qty: z.coerce.number().int().min(1).default(1),
        nominal: z.coerce.number().min(0).default(0),
      })
    )
    .optional()
    .default([]),

  // Complimentaries — new complimentary-based, snapped at finalize time
  complimentaries: z
    .array(
      z.object({
        complimentaryId: z.string().optional().nullable(),
        name: z.string().min(1),
        price: z.coerce.number().int().min(0).default(0),
        isShowPrice: z.boolean().default(false),
        description: z.string().optional().nullable(),
        qty: z.coerce.number().int().min(1).default(1),
        sortOrder: z.coerce.number().int().default(0),
      })
    )
    .optional()
    .default([]),

  // Category toggles for snap creation
  categoryToggles: z
    .array(
      z.object({
        categoryName: z.string().min(1),
        basePrice: z.coerce.number().int().min(0),
        sortOrder: z.coerce.number().int().default(0),
        isShow: z.boolean().default(true),
        isTakeout: z.boolean().default(false),
        takeoutNominal: z.coerce.number().int().min(0).default(0),
      })
    )
    .optional()
    .default([]),
});

export type FinalizeDraftInput = z.infer<typeof finalizeDraftSchema>;
