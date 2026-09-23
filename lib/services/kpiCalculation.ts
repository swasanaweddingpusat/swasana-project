// FILE: lib/services/kpiCalculation.ts
//
// Pure TypeScript — no DB calls, no Next.js imports.
// All monetary arithmetic uses Decimal from @prisma/client/runtime/client.

import { Decimal } from "@prisma/client/runtime/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KpiTierAction = "bonus" | "deduction" | "warning" | "under_performance";
export type KpiBusinessRole = "sales" | "manager";
export type KpiIndicatorType = "dealing" | "omset" | "homebase";

export interface TierRule {
  id: string;
  label: string;
  lowerBound: Decimal;
  upperBound: Decimal | null;
  lowerInclusive: boolean; // true = >=; false = >
  upperInclusive: boolean; // true = <=; false = <
  isDraftBounds: boolean;
  actionType: KpiTierAction;
  dealingBonus: Decimal | null;
  omsetBonus: Decimal | null;
  homebaseBonus: Decimal | null;
  deductionPct: Decimal | null;
  isWarningFlag: boolean;
}

export interface AchievementSchemaInput {
  id: string;
  businessRole: KpiBusinessRole;
  isDraft: boolean;
  gatingMinIndicators: number | null; // null = use default 2
  tiers: TierRule[];
}

export interface CommissionPolicyInput {
  id: string;
  businessRole: KpiBusinessRole;
  isDraft: boolean;
  nominalPerDeal: Decimal | null; // fixed Rp per deal
  pctOfRevenue: Decimal | null; // % of omset (e.g. 0.0089 = 0.89%)
  packageCategory: "WEDDINGS" | "MICE" | null; // null = all categories
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}

export interface KpiRealization {
  dealingTotal: number;
  dealingReguler: number;
  dealingHadjatan: number;
  omsetTotal: Decimal;
  omsetReguler: Decimal;
  omsetHadjatan: Decimal;
  homebase: number;
}

export interface KpiTarget {
  dealingTotal: number | null;
  omsetTotal: Decimal | null;
  homebase: number | null;
}

export interface IndicatorResult {
  indicatorType: KpiIndicatorType;
  targetValue: Decimal | null;
  realValue: Decimal | null;
  achievementPct: Decimal | null;
  tier: TierRule | null;
  tierId: string | null;
  tierLabel: string | null;
  actionType: KpiTierAction | null;
  bonusAmount: Decimal | null;
  deductionPct: Decimal | null;
  isUnderPerformance: boolean;
  isWarning: boolean;
  isGatingFailed: boolean;
  cantCompute: boolean;
  notes: string | null;
}

export interface KpiCalculationOutput {
  businessRole: KpiBusinessRole;
  dealing: IndicatorResult;
  omset: IndicatorResult;
  homebase: IndicatorResult;
  gatingPassed: boolean;
  gatingEligibleCount: number;
  baseCommissionReguler: Decimal | null;
  baseCommissionHadjatan: Decimal | null;
  baseCommissionTotal: Decimal | null;
  totalBonus: Decimal | null;
  deductionTriggerIndicator: KpiIndicatorType | null;
  deductionPct: Decimal | null;
  deductionAmount: Decimal | null;
  deductionBasisAmbiguous: boolean;
  grossAmount: Decimal | null;
  netAmount: Decimal | null;
  canFinalize: boolean;
  missingDataReasons: string[];
  isDraftScheme: boolean;
  status: "ok" | "incomplete" | "pending_decision";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Sort tiers by lowerBound ascending (stable).
 */
function sortTiers(tiers: TierRule[]): TierRule[] {
  return [...tiers].sort((a, b) => {
    if (a.lowerBound.lt(b.lowerBound)) return -1;
    if (a.lowerBound.gt(b.lowerBound)) return 1;
    return 0;
  });
}

/**
 * Test whether achievementPct satisfies the lower bound of a tier.
 */
function meetsLowerBound(pct: Decimal, tier: TierRule): boolean {
  if (tier.lowerInclusive) {
    return pct.gte(tier.lowerBound);
  }
  return pct.gt(tier.lowerBound);
}

/**
 * Test whether achievementPct satisfies the upper bound of a tier.
 * If upperBound is null the tier is open-ended: always passes.
 */
function meetsUpperBound(pct: Decimal, tier: TierRule): boolean {
  if (tier.upperBound === null) return true;
  if (tier.upperInclusive) {
    return pct.lte(tier.upperBound);
  }
  return pct.lt(tier.upperBound);
}

/**
 * Extract the bonus amount for a specific indicator type from a matched tier.
 */
function bonusForIndicator(
  indicatorType: KpiIndicatorType,
  tier: TierRule,
): Decimal | null {
  switch (indicatorType) {
    case "dealing":
      return tier.dealingBonus;
    case "omset":
      return tier.omsetBonus;
    case "homebase":
      return tier.homebaseBonus;
  }
}

/**
 * Build a blank (cantCompute) IndicatorResult for cases where targets are missing/zero.
 */
function cantComputeResult(
  indicatorType: KpiIndicatorType,
  realValue: Decimal,
  targetValue: Decimal | null,
  noteKey: "target_missing" | "target_is_zero",
): IndicatorResult {
  return {
    indicatorType,
    targetValue,
    realValue,
    achievementPct: null,
    tier: null,
    tierId: null,
    tierLabel: null,
    actionType: null,
    bonusAmount: null,
    deductionPct: null,
    isUnderPerformance: false,
    isWarning: false,
    isGatingFailed: false,
    cantCompute: true,
    notes: noteKey,
  };
}

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * Check if achievementPct falls within a tier's bounds.
 * Tiers are sorted by lowerBound ascending before searching.
 * Uses lowerInclusive / upperInclusive flags from the tier.
 */
export function findTier(
  achievementPct: Decimal,
  tiers: TierRule[],
): TierRule | null {
  const sorted = sortTiers(tiers);
  for (const tier of sorted) {
    if (meetsLowerBound(achievementPct, tier) && meetsUpperBound(achievementPct, tier)) {
      return tier;
    }
  }
  return null;
}

/**
 * Evaluate one KPI indicator.
 * Gets bonus amount for the specific indicatorType from the matched tier's
 * dealingBonus / omsetBonus / homebaseBonus field accordingly.
 */
export function evaluateIndicator(
  indicatorType: KpiIndicatorType,
  realValue: Decimal,
  targetValue: Decimal | null,
  tiers: TierRule[],
  gatingFailed: boolean,
): IndicatorResult {
  // Guard: null target
  if (targetValue === null) {
    return cantComputeResult(indicatorType, realValue, null, "target_missing");
  }

  // Guard: zero target (would cause division by zero)
  if (targetValue.lte(new Decimal(0))) {
    return cantComputeResult(indicatorType, realValue, targetValue, "target_is_zero");
  }

  // Achievement % = actual / target * 100
  const achievementPct = realValue.div(targetValue).mul(new Decimal(100));

  // Find matching tier
  const tier = findTier(achievementPct, tiers);

  if (tier === null) {
    // No tier matched — treat as under_performance
    return {
      indicatorType,
      targetValue,
      realValue,
      achievementPct,
      tier: null,
      tierId: null,
      tierLabel: null,
      actionType: "under_performance",
      bonusAmount: null,
      deductionPct: null,
      isUnderPerformance: true,
      isWarning: false,
      isGatingFailed: false,
      cantCompute: false,
      notes: "no_tier_matched",
    };
  }

  const actionType = tier.actionType;
  const isUnderPerformance = actionType === "under_performance";
  const isWarning = tier.isWarningFlag || actionType === "warning";

  // Bonus: only when action is "bonus" AND gating passed
  let bonusAmount: Decimal | null = null;
  if (actionType === "bonus") {
    if (gatingFailed) {
      bonusAmount = null; // gating blocked bonus
    } else {
      bonusAmount = bonusForIndicator(indicatorType, tier);
    }
  }

  // Deduction pct comes from the tier itself
  const deductionPct = actionType === "deduction" ? tier.deductionPct : null;

  return {
    indicatorType,
    targetValue,
    realValue,
    achievementPct,
    tier,
    tierId: tier.id,
    tierLabel: tier.label,
    actionType,
    bonusAmount,
    deductionPct,
    isUnderPerformance,
    isWarning,
    isGatingFailed: gatingFailed && actionType === "bonus",
    cantCompute: false,
    notes: null,
  };
}

/**
 * Evaluate manager gating.
 * Returns passed=true if eligibleCount >= minRequired.
 * An indicator is "eligible" if its actionType === "bonus" (tier at >=100% range).
 * Sales always passes (gating not applicable).
 */
export function evaluateGating(
  indicatorResults: IndicatorResult[],
  schema: AchievementSchemaInput,
): { passed: boolean; eligibleCount: number; isDraftDefinition: boolean } {
  if (schema.businessRole === "sales") {
    return { passed: true, eligibleCount: indicatorResults.length, isDraftDefinition: false };
  }

  // Count indicators that hit bonus tier
  const eligibleCount = indicatorResults.filter(
    (r) => r.actionType === "bonus",
  ).length;

  const minRequired = schema.gatingMinIndicators ?? 2;

  // isDraftDefinition: true when we derive eligibility from "bonus tier" (provisional rule)
  // per spec — this is always provisional for manager gating
  const isDraftDefinition = true;

  const passed = eligibleCount >= minRequired;
  return { passed, eligibleCount, isDraftDefinition };
}

/**
 * Compute base commission from active (non-draft) policies for this period.
 * Returns null amounts with explanation if no active policy found.
 * For nominalPerDeal policies: commission = nominalPerDeal * dealCount
 * For pctOfRevenue policies: commission = pctOfRevenue * omset
 */
export function computeBaseCommission(
  realization: KpiRealization,
  policies: CommissionPolicyInput[],
  period: Date,
): {
  reguler: Decimal | null;
  hadjatan: Decimal | null;
  total: Decimal | null;
  missing: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Filter to non-draft policies effective for this period
  const activePolicies = policies.filter((p) => {
    if (p.isDraft) return false;
    if (p.effectiveFrom !== null && period < p.effectiveFrom) return false;
    if (p.effectiveTo !== null && period > p.effectiveTo) return false;
    return true;
  });

  if (activePolicies.length === 0) {
    reasons.push("base_commission_missing");
    return { reguler: null, hadjatan: null, total: null, missing: true, reasons };
  }

  // Split policies by packageCategory
  const wedPolicies = activePolicies.filter(
    (p) => p.packageCategory === "WEDDINGS" || p.packageCategory === null,
  );
  const micePolicies = activePolicies.filter(
    (p) => p.packageCategory === "MICE" || p.packageCategory === null,
  );

  // Helper: compute commission for a single policy + given deal count + omset
  function applyPolicy(
    policy: CommissionPolicyInput,
    dealCount: number,
    omset: Decimal,
  ): Decimal {
    if (policy.nominalPerDeal !== null) {
      return policy.nominalPerDeal.mul(new Decimal(dealCount));
    }
    if (policy.pctOfRevenue !== null) {
      return policy.pctOfRevenue.mul(omset);
    }
    return new Decimal(0);
  }

  // Helper: pick the best-matching policy for a category from a set
  // Prefer packageCategory-specific over null (all-categories) when both exist
  function pickPolicy(
    all: CommissionPolicyInput[],
    category: "WEDDINGS" | "MICE",
  ): CommissionPolicyInput | null {
    const specific = all.find((p) => p.packageCategory === category);
    if (specific) return specific;
    const general = all.find((p) => p.packageCategory === null);
    return general ?? null;
  }

  // Reguler commission (WEDDINGS category, or general)
  let reguler: Decimal | null = null;
  const wedPolicy = pickPolicy(wedPolicies, "WEDDINGS");
  if (wedPolicy !== null) {
    reguler = applyPolicy(
      wedPolicy,
      realization.dealingReguler,
      realization.omsetReguler,
    );
  } else {
    reasons.push("base_commission_missing_reguler");
  }

  // Hadjatan commission (MICE category, or general)
  let hadjatan: Decimal | null = null;
  const micePolicy = pickPolicy(micePolicies, "MICE");
  if (micePolicy !== null) {
    hadjatan = applyPolicy(
      micePolicy,
      realization.dealingHadjatan,
      realization.omsetHadjatan,
    );
  } else {
    reasons.push("base_commission_missing_hadjatan");
  }

  // Total
  let total: Decimal | null = null;
  if (reguler !== null && hadjatan !== null) {
    total = reguler.add(hadjatan);
  } else if (reguler !== null) {
    total = reguler;
  } else if (hadjatan !== null) {
    total = hadjatan;
  }

  const missing = reguler === null && hadjatan === null;
  if (missing && !reasons.includes("base_commission_missing")) {
    reasons.push("base_commission_missing");
  }

  return { reguler, hadjatan, total, missing, reasons };
}

/**
 * Main entry point. Combines all above into one output.
 */
export function computeKpiResult(input: {
  businessRole: KpiBusinessRole;
  realization: KpiRealization;
  target: KpiTarget;
  schema: AchievementSchemaInput;
  commissionPolicies: CommissionPolicyInput[];
  period: Date;
}): KpiCalculationOutput {
  const { businessRole, realization, target, schema, commissionPolicies, period } = input;
  const missingDataReasons: string[] = [];
  let status: "ok" | "incomplete" | "pending_decision" = "ok";

  // ── 1. Draft scheme check ────────────────────────────────────────────────────
  const isDraftScheme = schema.isDraft;
  if (isDraftScheme) {
    missingDataReasons.push("scheme_is_draft");
  }
  if (schema.tiers.some((tier) => tier.isDraftBounds)) {
    missingDataReasons.push("tier_bounds_draft");
    status = "pending_decision";
  }

  // ── 2. Convert targets to Decimal ───────────────────────────────────────────
  const dealingTarget =
    target.dealingTotal !== null ? new Decimal(target.dealingTotal) : null;
  const omsetTarget = target.omsetTotal ?? null;
  const homebaseTarget =
    target.homebase !== null ? new Decimal(target.homebase) : null;

  // ── 3. Convert realizations to Decimal ──────────────────────────────────────
  const dealingReal = new Decimal(realization.dealingTotal);
  const omsetReal = realization.omsetTotal;
  const homebaseReal = new Decimal(realization.homebase);
  if (
    dealingReal.isNegative() ||
    omsetReal.isNegative() ||
    homebaseReal.isNegative()
  ) {
    missingDataReasons.push("realization_negative");
  }

  // ── 4. First pass: evaluate indicators without gating (to determine gating) ─
  const tiers = schema.tiers;

  const dealingPre = evaluateIndicator(
    "dealing",
    dealingReal,
    dealingTarget,
    tiers,
    false, // gating not applied yet
  );
  const omsetPre = evaluateIndicator("omset", omsetReal, omsetTarget, tiers, false);
  const homebasePre = evaluateIndicator(
    "homebase",
    homebaseReal,
    homebaseTarget,
    tiers,
    false,
  );

  // ── 5. Evaluate gating ───────────────────────────────────────────────────────
  const gatingResult = evaluateGating([dealingPre, omsetPre, homebasePre], schema);
  const gatingPassed = gatingResult.passed;

  // ── 6. Re-evaluate indicators with correct gating flag ───────────────────────
  // For sales: gating always passes, so re-evaluation is a no-op.
  // For manager: if gating failed, bonus amounts become null.
  const gatingFailed = !gatingPassed;

  const dealing = evaluateIndicator(
    "dealing",
    dealingReal,
    dealingTarget,
    tiers,
    gatingFailed,
  );
  const omset = evaluateIndicator("omset", omsetReal, omsetTarget, tiers, gatingFailed);
  const homebase = evaluateIndicator(
    "homebase",
    homebaseReal,
    homebaseTarget,
    tiers,
    gatingFailed,
  );

  // ── 7. Manager warning / <70% conflict check ─────────────────────────────────
  const hasWarning =
    dealing.isWarning || omset.isWarning || homebase.isWarning;
  if (businessRole === "manager" && hasWarning) {
    missingDataReasons.push("manager_lt70_conflict_unresolved");
    status = "pending_decision";
  }

  // ── 8. Compute base commission ───────────────────────────────────────────────
  const commission = computeBaseCommission(realization, commissionPolicies, period);
  if (commission.missing || commission.reasons.length > 0) {
    for (const r of commission.reasons) {
      if (!missingDataReasons.includes(r)) {
        missingDataReasons.push(r);
      }
    }
  }

  // ── 9. Total bonus ───────────────────────────────────────────────────────────
  // Sum all non-null bonusAmounts from the three indicators
  let totalBonus: Decimal | null = null;
  const bonuses: Decimal[] = [];
  if (dealing.bonusAmount !== null) bonuses.push(dealing.bonusAmount);
  if (omset.bonusAmount !== null) bonuses.push(omset.bonusAmount);
  if (homebase.bonusAmount !== null) bonuses.push(homebase.bonusAmount);

  if (bonuses.length > 0) {
    totalBonus = bonuses.reduce((acc, b) => acc.add(b), new Decimal(0));
  }

  // ── 10. Deduction ────────────────────────────────────────────────────────────
  // Deduction is triggered by the dealing indicator.
  let deductionTriggerIndicator: KpiIndicatorType | null = null;
  let deductionPct: Decimal | null = null;
  let deductionAmount: Decimal | null = null;
  let deductionBasisAmbiguous = false;

  if (dealing.actionType === "deduction" && dealing.deductionPct !== null) {
    deductionTriggerIndicator = "dealing";
    deductionPct = dealing.deductionPct;
    // The PRD requires the deduction basis to be an approved policy decision.
    deductionBasisAmbiguous = true;
    missingDataReasons.push("deduction_basis_unresolved");
    status = "pending_decision";
    if (commission.total !== null) {
      deductionAmount = commission.total.mul(deductionPct).div(new Decimal(100));
    }
  }

  // ── 11. Gross & net ──────────────────────────────────────────────────────────
  let grossAmount: Decimal | null = null;
  if (commission.total !== null && totalBonus !== null) {
    grossAmount = commission.total.add(totalBonus);
  } else if (commission.total !== null && totalBonus === null) {
    // No bonus tier reached but commission exists → gross = commission only
    // (only when no indicators at bonus tier and no gating situation)
    const anyBonusTier =
      dealing.actionType === "bonus" ||
      omset.actionType === "bonus" ||
      homebase.actionType === "bonus";
    if (!anyBonusTier) {
      grossAmount = commission.total;
    }
    // If there was a bonus tier but null due to gating, gross stays null
    // (pending gating resolution)
  }

  let netAmount: Decimal | null = null;
  if (grossAmount !== null && deductionAmount !== null) {
    netAmount = grossAmount.sub(deductionAmount);
  } else if (grossAmount !== null && deductionTriggerIndicator === null) {
    // No deduction triggered — net equals gross
    netAmount = grossAmount;
  }

  // ── 12. Collect missing reasons for incomplete data ──────────────────────────
  if (dealing.cantCompute) missingDataReasons.push("dealing_target_missing");
  if (omset.cantCompute) missingDataReasons.push("omset_target_missing");
  if (homebase.cantCompute) missingDataReasons.push("homebase_target_missing");

  // ── 13. Final status ─────────────────────────────────────────────────────────
  if (status !== "pending_decision" && missingDataReasons.length > 0) {
    status = "incomplete";
  }

  // canFinalize: all reasons must be empty
  const canFinalize = missingDataReasons.length === 0;

  return {
    businessRole,
    dealing,
    omset,
    homebase,
    gatingPassed,
    gatingEligibleCount: gatingResult.eligibleCount,
    baseCommissionReguler: commission.reguler,
    baseCommissionHadjatan: commission.hadjatan,
    baseCommissionTotal: commission.total,
    totalBonus,
    deductionTriggerIndicator,
    deductionPct,
    deductionAmount,
    deductionBasisAmbiguous,
    grossAmount,
    netAmount,
    canFinalize,
    missingDataReasons,
    isDraftScheme,
    status,
  };
}
