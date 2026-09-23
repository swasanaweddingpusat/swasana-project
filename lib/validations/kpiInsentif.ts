// FILE: lib/validations/kpiInsentif.ts
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const kpiTargetTypeEnum = z.enum(["qty", "price"]);
export const kpiIndicatorTypeEnum = z.enum(["dealing", "omset", "homebase"]);
export const kpiBusinessRoleEnum = z.enum(["sales", "manager"]);
export const kpiTierActionEnum = z.enum(["bonus", "deduction", "warning", "under_performance"]);
export const kpiResultStatusEnum = z.enum(["DRAFT", "SIMULATED", "PENDING_REVIEW", "FINALIZED"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Coerce "YYYY-MM-DD" or a Date to the first day of that month (stored as Date).
 */
const firstOfMonthDate = z.coerce.date().transform((d) => {
  return new Date(d.getFullYear(), d.getMonth(), 1);
});

/**
 * Decimal string: accepts a number or numeric string, no negative.
 */
const nonNegativeDecimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "Nilai harus berupa angka desimal positif")
  .refine((v) => parseFloat(v) >= 0, "Nilai tidak boleh negatif");

const positiveDecimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "Nilai harus berupa angka desimal")
  .refine((v) => parseFloat(v) > 0, "Target harus lebih besar dari nol");

// ─── KpiTargetItem ────────────────────────────────────────────────────────────

const targetItemBaseSchema = z.object({
  name: z.string().min(1, "Nama target wajib diisi"),
  indicatorType: kpiIndicatorTypeEnum,
  type: kpiTargetTypeEnum,
  qty: z.number().int().positive().optional().nullable(),
  price: positiveDecimalString.optional().nullable(),
  qtyReguler: z.number().int().positive().optional().nullable(),
  qtyHadjatan: z.number().int().positive().optional().nullable(),
  priceReguler: positiveDecimalString.optional().nullable(),
  priceHadjatan: positiveDecimalString.optional().nullable(),
  regulerCategory: z.enum(["WEDDINGS", "MICE"]).optional().nullable(),
  hadjatanCategory: z.enum(["WEDDINGS", "MICE"]).optional().nullable(),
});

export const createTargetItemSchema = targetItemBaseSchema.superRefine((data, ctx) => {
  if (data.type === "qty") {
    const hasFlat = data.qty != null && data.qty > 0;
    const hasSplit = data.qtyReguler != null && data.qtyHadjatan != null;
    if (!hasFlat && !hasSplit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Qty wajib diisi (flat atau reguler+hadjatan)",
        path: ["qty"],
      });
    }
  }
  if (data.type === "price") {
    const hasFlat = data.price != null;
    const hasSplit = data.priceReguler != null && data.priceHadjatan != null;
    if (!hasFlat && !hasSplit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Harga wajib diisi (flat atau reguler+hadjatan)",
        path: ["price"],
      });
    }
  }
});

export const updateTargetItemSchema = targetItemBaseSchema.partial();

export type CreateTargetItemInput = z.infer<typeof createTargetItemSchema>;
export type UpdateTargetItemInput = z.infer<typeof updateTargetItemSchema>;

// ─── KpiAchievementTier ───────────────────────────────────────────────────────

export const tierSchema = z
  .object({
    id: z.string().optional(), // omit on create; present on update
    sortOrder: z.number().int().min(0),
    label: z.string().min(1, "Label tier wajib diisi"),
    lowerBound: nonNegativeDecimalString,
    upperBound: nonNegativeDecimalString.optional().nullable(),
    lowerInclusive: z.boolean().default(true),
    upperInclusive: z.boolean().default(false),
    isDraftBounds: z.boolean().default(false),
    actionType: kpiTierActionEnum,
    dealingBonus: nonNegativeDecimalString.optional().nullable(),
    omsetBonus: nonNegativeDecimalString.optional().nullable(),
    homebaseBonus: nonNegativeDecimalString.optional().nullable(),
    deductionPct: nonNegativeDecimalString.optional().nullable(),
    isWarningFlag: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // upperBound must be > lowerBound when provided
    if (data.upperBound != null) {
      const lower = parseFloat(data.lowerBound);
      const upper = parseFloat(data.upperBound);
      if (upper <= lower) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Batas atas harus lebih besar dari batas bawah",
          path: ["upperBound"],
        });
      }
    }
    // bonus action requires at least one bonus value
    if (data.actionType === "bonus") {
      const hasBonus =
        data.dealingBonus != null ||
        data.omsetBonus != null ||
        data.homebaseBonus != null;
      if (!hasBonus) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Minimal satu nilai bonus harus diisi untuk tipe 'bonus'",
          path: ["dealingBonus"],
        });
      }
    }
    // deduction action requires deductionPct
    if (data.actionType === "deduction" && data.deductionPct == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Persentase potongan wajib diisi untuk tipe 'deduction'",
        path: ["deductionPct"],
      });
    }
  });

export type TierInput = z.infer<typeof tierSchema>;

// ─── KpiAchievementSchema ─────────────────────────────────────────────────────

export const createAchievementSchemaSchema = z.object({
  name: z.string().min(1, "Nama skema wajib diisi"),
  description: z.string().optional().nullable(),
  businessRole: kpiBusinessRoleEnum,
  isDraft: z.boolean().default(true),
  gatingMinIndicators: z.number().int().min(1).max(3).optional().nullable(),
});

export const updateAchievementSchemaSchema = createAchievementSchemaSchema.partial();

export const upsertTiersSchema = z.object({
  achievementSchemaId: z.string().min(1),
  tiers: z
    .array(tierSchema)
    .min(1, "Minimal satu tier harus didefinisikan")
    .refine(
      (tiers) => {
        const orders = tiers.map((t) => t.sortOrder);
        return new Set(orders).size === orders.length;
      },
      { message: "sortOrder tier harus unik" }
    ),
});

export type CreateAchievementSchemaInput = z.infer<typeof createAchievementSchemaSchema>;
export type UpdateAchievementSchemaInput = z.infer<typeof updateAchievementSchemaSchema>;
export type UpsertTiersInput = z.infer<typeof upsertTiersSchema>;

// ─── KpiMaster ────────────────────────────────────────────────────────────────

export const createKpiMasterSchema = z.object({
  name: z.string().min(1, "Nama KPI master wajib diisi"),
  description: z.string().optional().nullable(),
  month: firstOfMonthDate,
  businessRole: kpiBusinessRoleEnum,
  isDraft: z.boolean().default(true),
  targetItemId: z.string().min(1, "Target item wajib dipilih"),
  achievementSchemaId: z.string().min(1, "Skema achievement wajib dipilih"),
});

export const updateKpiMasterSchema = createKpiMasterSchema.partial();

export type CreateKpiMasterInput = z.infer<typeof createKpiMasterSchema>;
export type UpdateKpiMasterInput = z.infer<typeof updateKpiMasterSchema>;

// ─── KpiAssignment ────────────────────────────────────────────────────────────

const assignmentBaseSchema = z.object({
  kpiMasterId: z.string().min(1, "KPI Master wajib dipilih"),
  profileId: z.string().min(1, "Sales wajib dipilih"),
  venueId: z.string().optional().nullable(),
  period: firstOfMonthDate,
  targetQty: z.number().int().min(0).optional().nullable(),
  targetPrice: nonNegativeDecimalString.optional().nullable(),
  isDraft: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const createAssignmentSchema = assignmentBaseSchema.superRefine((data, ctx) => {
  if (data.targetQty == null && data.targetPrice == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimal targetQty atau targetPrice harus diisi",
      path: ["targetQty"],
    });
  }
});

export const updateAssignmentSchema = assignmentBaseSchema.partial();

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

// ─── KpiCommissionPolicy ──────────────────────────────────────────────────────

const commissionPolicyBaseSchema = z.object({
  name: z.string().min(1, "Nama kebijakan komisi wajib diisi"),
  description: z.string().optional().nullable(),
  businessRole: kpiBusinessRoleEnum,
  isDraft: z.boolean().default(true),
  nominalPerDeal: nonNegativeDecimalString.optional().nullable(),
  pctOfRevenue: nonNegativeDecimalString.optional().nullable(),
  packageCategory: z.enum(["WEDDINGS", "MICE"]).optional().nullable(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export const createCommissionPolicySchema = commissionPolicyBaseSchema.superRefine((data, ctx) => {
  if (data.nominalPerDeal == null && data.pctOfRevenue == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimal nominalPerDeal atau pctOfRevenue harus diisi",
      path: ["nominalPerDeal"],
    });
  }
  if (data.effectiveFrom && data.effectiveTo) {
    if (data.effectiveTo < data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tanggal akhir berlaku harus setelah tanggal mulai",
        path: ["effectiveTo"],
      });
    }
  }
});

export const updateCommissionPolicySchema = commissionPolicyBaseSchema.partial();

export type CreateCommissionPolicyInput = z.infer<typeof createCommissionPolicySchema>;
export type UpdateCommissionPolicyInput = z.infer<typeof updateCommissionPolicySchema>;

// ─── Simulation / Finalize ────────────────────────────────────────────────────

export const runSimulationSchema = z.object({
  profileId: z.string().min(1, "Profile wajib dipilih"),
  period: firstOfMonthDate,
  venueId: z.string().optional().nullable(),
});

export const finalizeResultSchema = z.object({
  resultId: z.string().min(1, "Result ID wajib diisi"),
});

export type RunSimulationInput = z.infer<typeof runSimulationSchema>;
export type FinalizeResultInput = z.infer<typeof finalizeResultSchema>;
