// FILE: lib/validations/kpiInsentif.ts
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const kpiBusinessRoleEnum = z.enum(["sales", "manager"]);
export const kpiTierActionEnum = z.enum(["bonus", "deduction", "warning", "under_performance"]);
export const kpiResultStatusEnum = z.enum(["DRAFT", "SIMULATED", "PENDING_REVIEW", "FINALIZED"]);
export const kpiAwardRankingMetricEnum = z.enum([
  "totalBonus",
  "netAmount",
  "dealingAchievementPct",
  "omsetAchievementPct",
  "manual",
]);

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

/**
 * Percentage string bounded 0-100 (e.g. staged-payment payout %).
 */
const percentageDecimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "Nilai harus berupa angka desimal")
  .refine((v) => parseFloat(v) >= 0 && parseFloat(v) <= 100, "Persentase harus di antara 0-100");

// ─── KpiTargetItem ────────────────────────────────────────────────────────────

const targetItemBaseSchema = z.object({
  name: z.string().min(1, "Nama target wajib diisi"),
  dealingQty: z.number().int().positive().optional().nullable(),
  dealingQtyReguler: z.number().int().positive().optional().nullable(),
  dealingQtyHadjatan: z.number().int().positive().optional().nullable(),
  omsetPrice: positiveDecimalString.optional().nullable(),
  omsetPriceReguler: positiveDecimalString.optional().nullable(),
  omsetPriceHadjatan: positiveDecimalString.optional().nullable(),
  homebaseQty: z.number().int().positive().optional().nullable(),
  homebaseQtyReguler: z.number().int().positive().optional().nullable(),
  homebaseQtyHadjatan: z.number().int().positive().optional().nullable(),
  regulerCategory: z.enum(["WEDDINGS", "MICE"]).optional().nullable(),
  hadjatanCategory: z.enum(["WEDDINGS", "MICE"]).optional().nullable(),
});

export const createTargetItemSchema = targetItemBaseSchema.superRefine((data, ctx) => {
  const hasDealing =
    (data.dealingQty != null && data.dealingQty > 0) ||
    (data.dealingQtyReguler != null && data.dealingQtyHadjatan != null);
  const hasOmset =
    data.omsetPrice != null || (data.omsetPriceReguler != null && data.omsetPriceHadjatan != null);
  const hasHomebase =
    (data.homebaseQty != null && data.homebaseQty > 0) ||
    (data.homebaseQtyReguler != null && data.homebaseQtyHadjatan != null);
  if (!hasDealing && !hasOmset && !hasHomebase) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimal satu target indikator (dealing/omset/homebase) wajib diisi",
      path: ["dealingQty"],
    });
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

const achievementSchemaBaseSchema = z.object({
  name: z.string().min(1, "Nama skema wajib diisi"),
  description: z.string().optional().nullable(),
  businessRole: kpiBusinessRoleEnum,
  isDraft: z.boolean().default(true),
  gatingMinIndicators: z.number().int().min(1).max(3).optional().nullable(),
  // ── Skema Pembayaran Bertahap (Tahap 1/2) — opt-in ──────────────────────────
  stagedPaymentEnabled: z.boolean().default(false),
  stage1PayoutPct: percentageDecimalString.optional().nullable(),
  stage2PayoutPct: percentageDecimalString.optional().nullable(),
  stage1MinClientPayment: z.number().int().min(0).optional().nullable(),
  stage2PayoutMonthOffset: z.number().int().min(1).optional().nullable(),
});

export const createAchievementSchemaSchema = achievementSchemaBaseSchema.superRefine((data, ctx) => {
  if (!data.stagedPaymentEnabled) return;
  if (data.stage1PayoutPct == null || data.stage2PayoutPct == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Tahap 1 dan Tahap 2 wajib diisi saat pembayaran bertahap aktif",
      path: ["stage1PayoutPct"],
    });
    return;
  }
  const sum = parseFloat(data.stage1PayoutPct) + parseFloat(data.stage2PayoutPct);
  if (Math.abs(sum - 100) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Total Tahap 1 + Tahap 2 harus 100%",
      path: ["stage2PayoutPct"],
    });
  }
});

export const updateAchievementSchemaSchema = achievementSchemaBaseSchema.partial();

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

// NOTE: targetQty/targetPrice are no longer required here — with a unified
// KpiTargetItem (dealing+omset+homebase on one row), a single generic
// targetQty/targetPrice override can no longer unambiguously map to "which
// indicator is this overriding". These columns are kept for backward
// compatibility but are not consulted by the calculation engine anymore
// (see actions/kpiInsentif.ts runAutoCalculation).
export const createAssignmentSchema = assignmentBaseSchema;

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
  // ── Bonus over-achievement (>100% target) — opt-in ──────────────────────────
  overAchievementNominalPerExtraDeal: nonNegativeDecimalString.optional().nullable(),
  overAchievementPctOfExtraRevenue: nonNegativeDecimalString.optional().nullable(),
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

// ─── Staged payment payout (Tahap 1 / Tahap 2 mark-paid) ───────────────────────

export const runStagePayoutSchema = z.object({
  resultId: z.string().min(1, "Result ID wajib diisi"),
  stage: z.union([z.literal(1), z.literal(2)]),
});

export type RunStagePayoutInput = z.infer<typeof runStagePayoutSchema>;

// ─── KpiAward ─────────────────────────────────────────────────────────────────

const awardBaseSchema = z.object({
  name: z.string().min(1, "Nama award wajib diisi"),
  description: z.string().optional().nullable(),
  businessRole: kpiBusinessRoleEnum.optional().nullable(), // null = semua role
  isRanked: z.boolean().default(true),
  rankingMetric: kpiAwardRankingMetricEnum.optional().nullable(),
  defaultPrizeDescription: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const createAwardSchema = awardBaseSchema.superRefine((data, ctx) => {
  if (data.isRanked) {
    if (data.rankingMetric == null || data.rankingMetric === "manual") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Award ranked wajib punya rankingMetric (bukan manual)",
        path: ["rankingMetric"],
      });
    }
  }
});

export const updateAwardSchema = awardBaseSchema.partial();

export type CreateAwardInput = z.infer<typeof createAwardSchema>;
export type UpdateAwardInput = z.infer<typeof updateAwardSchema>;

// ─── KpiAwardWinner ───────────────────────────────────────────────────────────

const awardWinnerBaseSchema = z.object({
  awardId: z.string().min(1, "Award wajib dipilih"),
  period: firstOfMonthDate,
  // Exactly-one XOR: profileId (individual) / groupId (team) — enforced below.
  profileId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  prizeDescription: z.string().optional().nullable(),
  rankValueSnapshot: nonNegativeDecimalString.optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createAwardWinnerSchema = awardWinnerBaseSchema.superRefine((data, ctx) => {
  const hasProfile = data.profileId != null && data.profileId !== "";
  const hasGroup = data.groupId != null && data.groupId !== "";
  if (hasProfile === hasGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Pilih salah satu: pemenang individu (profileId) atau tim (groupId)",
      path: ["profileId"],
    });
  }
});

export const updateAwardWinnerSchema = awardWinnerBaseSchema.partial();

export type CreateAwardWinnerInput = z.infer<typeof createAwardWinnerSchema>;
export type UpdateAwardWinnerInput = z.infer<typeof updateAwardWinnerSchema>;
