import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import {
  computeKpiResult,
  type AchievementSchemaInput,
  type CommissionPolicyInput,
  type KpiRealization,
  type KpiTarget,
  type TierRule,
} from "@/lib/services/kpiCalculation";

const realization: KpiRealization = {
  dealingTotal: 8,
  dealingReguler: 8,
  dealingHadjatan: 0,
  omsetTotal: new Decimal("100000000"),
  omsetReguler: new Decimal("100000000"),
  omsetHadjatan: new Decimal(0),
  homebase: 4,
};

const target: KpiTarget = {
  dealingTotal: 8,
  omsetTotal: new Decimal("100000000"),
  homebase: 4,
};

const policy: CommissionPolicyInput = {
  id: "policy",
  businessRole: "sales",
  isDraft: false,
  nominalPerDeal: new Decimal("500000"),
  pctOfRevenue: null,
  packageCategory: null,
  effectiveFrom: null,
  effectiveTo: null,
};

function tier(overrides: Partial<TierRule> = {}): TierRule {
  return {
    id: "tier",
    label: "bonus",
    lowerBound: new Decimal(0),
    upperBound: null,
    lowerInclusive: true,
    upperInclusive: false,
    isDraftBounds: false,
    actionType: "bonus",
    dealingBonus: new Decimal("1000000"),
    omsetBonus: new Decimal("1000000"),
    homebaseBonus: new Decimal("1000000"),
    deductionPct: null,
    isWarningFlag: false,
    ...overrides,
  };
}

function schema(tiers: TierRule[]): AchievementSchemaInput {
  return {
    id: "schema",
    businessRole: "sales",
    isDraft: false,
    gatingMinIndicators: null,
    tiers,
  };
}

describe("computeKpiResult policy safety", () => {
  it("blocks finalization while tier bounds are still draft", () => {
    const result = computeKpiResult({
      businessRole: "sales",
      realization,
      target,
      schema: schema([tier({ isDraftBounds: true })]),
      commissionPolicies: [policy],
      period: new Date("2026-09-01"),
    });

    expect(result.canFinalize).toBe(false);
    expect(result.status).toBe("pending_decision");
    expect(result.missingDataReasons).toContain("tier_bounds_draft");
  });

  it("blocks finalization when a deduction has no approved basis", () => {
    const result = computeKpiResult({
      businessRole: "sales",
      realization: { ...realization, dealingTotal: 1 },
      target,
      schema: schema([
        tier({
          actionType: "deduction",
          upperBound: new Decimal(100),
          deductionPct: new Decimal(50),
          dealingBonus: null,
          omsetBonus: null,
          homebaseBonus: null,
        }),
      ]),
      commissionPolicies: [policy],
      period: new Date("2026-09-01"),
    });

    expect(result.canFinalize).toBe(false);
    expect(result.missingDataReasons).toContain("deduction_basis_unresolved");
  });

  it("rejects negative realizations as incomplete input", () => {
    const result = computeKpiResult({
      businessRole: "sales",
      realization: { ...realization, dealingTotal: -1 },
      target,
      schema: schema([tier()]),
      commissionPolicies: [policy],
      period: new Date("2026-09-01"),
    });

    expect(result.canFinalize).toBe(false);
    expect(result.missingDataReasons).toContain("realization_negative");
  });
});
