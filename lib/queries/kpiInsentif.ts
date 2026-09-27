// FILE: lib/queries/kpiInsentif.ts
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

// Prisma Decimal objects can't cross the Server→Client boundary.
// Convert them to numbers so query results are plain-serializable.
function toPlain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, val) => {
    if (val !== null && typeof val === "object" && typeof val.toFixed === "function") return Number(val);
    if (val !== null && typeof val === "object" && "d" in val && "e" in val && "s" in val) return Number(val);
    return val;
  }));
}

// ─── Select shapes ────────────────────────────────────────────────────────────

const targetItemSelect = {
  id: true,
  name: true,
  indicatorType: true,
  type: true,
  qty: true,
  price: true,
  qtyReguler: true,
  qtyHadjatan: true,
  priceReguler: true,
  priceHadjatan: true,
  regulerCategory: true,
  hadjatanCategory: true,
  createdAt: true,
  updatedAt: true,
};

const tierSelect = {
  id: true,
  sortOrder: true,
  label: true,
  lowerBound: true,
  upperBound: true,
  lowerInclusive: true,
  upperInclusive: true,
  isDraftBounds: true,
  actionType: true,
  dealingBonus: true,
  omsetBonus: true,
  homebaseBonus: true,
  deductionPct: true,
  isWarningFlag: true,
  achievementSchemaId: true,
  createdAt: true,
  updatedAt: true,
};

const achievementSchemaRowSelect = {
  id: true,
  name: true,
  description: true,
  businessRole: true,
  isDraft: true,
  gatingMinIndicators: true,
  stagedPaymentEnabled: true,
  stage1PayoutPct: true,
  stage2PayoutPct: true,
  stage1MinClientPayment: true,
  stage2PayoutMonthOffset: true,
  createdAt: true,
  updatedAt: true,
};

const kpiMasterRowSelect = {
  id: true,
  name: true,
  description: true,
  month: true,
  businessRole: true,
  isDraft: true,
  targetItemId: true,
  achievementSchemaId: true,
  createdAt: true,
  updatedAt: true,
  targetItem: { select: { id: true, name: true, indicatorType: true, type: true } },
  achievementSchema: { select: { id: true, name: true, businessRole: true } },
  createdBy: { select: { id: true, fullName: true } },
};

const assignmentRowSelect = {
  id: true,
  kpiMasterId: true,
  profileId: true,
  venueId: true,
  period: true,
  targetQty: true,
  targetPrice: true,
  isDraft: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  kpiMaster: {
    select: {
      id: true,
      name: true,
      businessRole: true,
      targetItem: { select: { name: true, indicatorType: true, type: true } },
    },
  },
  profile: { select: { id: true, fullName: true } },
  venue: { select: { id: true, name: true } },
};

const commissionPolicyRowSelect = {
  id: true,
  name: true,
  description: true,
  businessRole: true,
  isDraft: true,
  nominalPerDeal: true,
  pctOfRevenue: true,
  packageCategory: true,
  effectiveFrom: true,
  effectiveTo: true,
  overAchievementNominalPerExtraDeal: true,
  overAchievementPctOfExtraRevenue: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  approvedBy: { select: { id: true, fullName: true } },
};

const resultRowSelect = {
  id: true,
  profileId: true,
  venueId: true,
  period: true,
  realDealingTotal: true,
  realOmsetTotal: true,
  realHomebase: true,
  targetDealingTotal: true,
  targetOmsetTotal: true,
  targetHomebase: true,
  dealingAchievementPct: true,
  omsetAchievementPct: true,
  homebaseAchievementPct: true,
  totalBonus: true,
  baseCommissionTotal: true,
  deductionAmount: true,
  grossAmount: true,
  netAmount: true,
  status: true,
  grade: true,
  missingDataReasons: true,
  calculatedAt: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  // ── Over-achievement bonus (additive, null = policy tidak dikonfigurasi) ────
  overAchievementDealingBonus: true,
  overAchievementOmsetBonus: true,
  overAchievementTotal: true,
  // ── Pembayaran bertahap (additive, null = fitur tidak aktif) ────────────────
  stage1Total: true,
  stage2Total: true,
  stage1EligibleAmount: true,
  stage2AdjustedAmount: true,
  stage2ClawbackAmount: true,
  stage1PaidAt: true,
  stage2PaidAt: true,
  profile: { select: { id: true, fullName: true } },
  venue: { select: { id: true, name: true } },
  finalizedBy: { select: { id: true, fullName: true } },
  stage1PaidBy: { select: { id: true, fullName: true } },
  stage2PaidBy: { select: { id: true, fullName: true } },
};

const calculationDetailSelect = {
  id: true,
  resultId: true,
  indicatorType: true,
  targetValue: true,
  realValue: true,
  achievementPct: true,
  tierId: true,
  tierLabel: true,
  actionType: true,
  bonusAmount: true,
  deductionPct: true,
  isGatingFailed: true,
  notes: true,
  createdAt: true,
};

// ─── KpiTargetItem ────────────────────────────────────────────────────────────

export async function getTargetItems() {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const rows = await db.kpiTargetItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: targetItemSelect,
  });
  return toPlain(rows);
}

export type TargetItemRow = Awaited<ReturnType<typeof getTargetItems>>[number];

export async function getTargetItemById(id: string) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const row = await db.kpiTargetItem.findUnique({
    where: { id },
    select: {
      ...targetItemSelect,
      kpiMasters: {
        take: 20,
        select: { id: true, name: true, month: true, businessRole: true },
        orderBy: { month: "desc" },
      },
    },
  });
  return toPlain(row);
}

export type TargetItemDetail = Awaited<ReturnType<typeof getTargetItemById>>;

// ─── KpiAchievementSchema ─────────────────────────────────────────────────────

export async function getAchievementSchemas(businessRole?: "sales" | "manager") {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const rows = await db.kpiAchievementSchema.findMany({
    where: businessRole ? { businessRole } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: achievementSchemaRowSelect,
  });
  return toPlain(rows);
}

export type AchievementSchemaRow = Awaited<ReturnType<typeof getAchievementSchemas>>[number];

export async function getAchievementSchemaById(id: string) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const row = await db.kpiAchievementSchema.findUnique({
    where: { id },
    select: {
      ...achievementSchemaRowSelect,
      tiers: {
        select: tierSelect,
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return toPlain(row);
}

export type AchievementSchemaDetail = Awaited<ReturnType<typeof getAchievementSchemaById>>;

// ─── KpiMaster ────────────────────────────────────────────────────────────────

export async function getKpiMasters(filters: {
  businessRole?: "sales" | "manager" | string;
  month?: Date;
}) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const where: {
    businessRole?: "sales" | "manager";
    month?: Date;
  } = {
    ...(filters.businessRole ? { businessRole: filters.businessRole as "sales" | "manager" } : {}),
    ...(filters.month ? { month: filters.month } : {}),
  };

  const rows = await db.kpiMaster.findMany({
    where,
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: kpiMasterRowSelect,
  });
  return toPlain(rows);
}

export type KpiMasterRow = Awaited<ReturnType<typeof getKpiMasters>>[number];

export async function getKpiMasterById(id: string) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const row = await db.kpiMaster.findUnique({
    where: { id },
    select: {
      ...kpiMasterRowSelect,
      assignments: {
        take: 100,
        select: {
          id: true,
          profileId: true,
          period: true,
          targetQty: true,
          targetPrice: true,
          isDraft: true,
          profile: { select: { id: true, fullName: true } },
          venue: { select: { id: true, name: true } },
        },
        orderBy: { period: "desc" },
      },
    },
  });
  return toPlain(row);
}

export type KpiMasterDetail = Awaited<ReturnType<typeof getKpiMasterById>>;

// ─── KpiAssignment ────────────────────────────────────────────────────────────

export async function getAssignments(filters: {
  profileId?: string;
  period?: Date;
  kpiMasterId?: string;
  venueId?: string;
  isDraft?: boolean;
}) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const where: {
    profileId?: string;
    period?: Date;
    kpiMasterId?: string;
    venueId?: string;
    isDraft?: boolean;
  } = {
    ...(filters.profileId ? { profileId: filters.profileId } : {}),
    ...(filters.period ? { period: filters.period } : {}),
    ...(filters.kpiMasterId ? { kpiMasterId: filters.kpiMasterId } : {}),
    ...(filters.venueId ? { venueId: filters.venueId } : {}),
    ...(filters.isDraft !== undefined ? { isDraft: filters.isDraft } : {}),
  };

  const rows = await db.kpiAssignment.findMany({
    where,
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: assignmentRowSelect,
  });
  return toPlain(rows);
}

export type AssignmentRow = Awaited<ReturnType<typeof getAssignments>>[number];

export async function getAssignmentById(id: string) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const row = await db.kpiAssignment.findUnique({
    where: { id },
    select: assignmentRowSelect,
  });
  return toPlain(row);
}

export type AssignmentDetail = Awaited<ReturnType<typeof getAssignmentById>>;

// ─── KpiCommissionPolicy ──────────────────────────────────────────────────────

export async function getCommissionPolicies(businessRole?: "sales" | "manager") {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const rows = await db.kpiCommissionPolicy.findMany({
    where: businessRole ? { businessRole } : undefined,
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: commissionPolicyRowSelect,
  });
  return toPlain(rows);
}

export type CommissionPolicyRow = Awaited<ReturnType<typeof getCommissionPolicies>>[number];

// ─── KpiCalculationResult ─────────────────────────────────────────────────────

export async function getCalculationResults(filters: {
  profileId?: string;
  period?: Date;
  status?: string;
  venueId?: string;
}) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("seconds");

  const where: {
    profileId?: string;
    period?: Date;
    status?: "DRAFT" | "SIMULATED" | "PENDING_REVIEW" | "FINALIZED";
    venueId?: string;
  } = {
    ...(filters.profileId ? { profileId: filters.profileId } : {}),
    ...(filters.period ? { period: filters.period } : {}),
    ...(filters.status ? { status: filters.status as "DRAFT" | "SIMULATED" | "PENDING_REVIEW" | "FINALIZED" } : {}),
    ...(filters.venueId ? { venueId: filters.venueId } : {}),
  };

  const rows = await db.kpiCalculationResult.findMany({
    where,
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: resultRowSelect,
  });
  return toPlain(rows);
}

export type ResultRow = Awaited<ReturnType<typeof getCalculationResults>>[number];

export async function getCalculationResultById(id: string) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("seconds");

  const row = await db.kpiCalculationResult.findUnique({
    where: { id },
    select: {
      ...resultRowSelect,
      realDealingReguler: true,
      realDealingHadjatan: true,
      realOmsetReguler: true,
      realOmsetHadjatan: true,
      dealingTierId: true,
      omsetTierId: true,
      homebaseTierId: true,
      dealingBonus: true,
      omsetBonus: true,
      homebaseBonus: true,
      baseCommissionReguler: true,
      baseCommissionHadjatan: true,
      deductionTriggerIndicator: true,
      deductionPct: true,
      policySnapshotId: true,
      notes: true,
      details: {
        select: calculationDetailSelect,
        orderBy: { createdAt: "asc" },
      },
      policySnapshot: {
        select: { id: true, snapshotData: true, createdAt: true },
      },
      dealLinks: {
        select: {
          id: true,
          bookingId: true,
          dealAmount: true,
          category: true,
          stage1Share: true,
          stage2Share: true,
          stage1Eligible: true,
        },
      },
    },
  });
  return toPlain(row);
}

export type ResultDetail = Awaited<ReturnType<typeof getCalculationResultById>>;

// ─── Profile picker for KPI assignment ───────────────────────────────────────

export async function getProfilesForKpiAssignment() {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const profiles = await db.profile.findMany({
    where: {
      status: "active",
      role: {
        isNot: null,
      },
    },
    orderBy: { fullName: "asc" },
    take: 100,
    select: {
      id: true,
      fullName: true,
      role: {
        select: { name: true },
      },
    },
  });

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    roleName: p.role?.name ?? "",
  }));
}

// ─── KpiAward ─────────────────────────────────────────────────────────────────

const awardRowSelect = {
  id: true,
  name: true,
  description: true,
  businessRole: true,
  isRanked: true,
  rankingMetric: true,
  defaultPrizeDescription: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function getKpiAwards(filters?: { businessRole?: "sales" | "manager"; isActive?: boolean }) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const rows = await db.kpiAward.findMany({
    where: {
      ...(filters?.businessRole ? { businessRole: filters.businessRole } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: awardRowSelect,
  });
  return toPlain(rows);
}

export type KpiAwardRow = Awaited<ReturnType<typeof getKpiAwards>>[number];

// ─── KpiAwardWinner ───────────────────────────────────────────────────────────

const awardWinnerRowSelect = {
  id: true,
  awardId: true,
  period: true,
  profileId: true,
  groupId: true,
  prizeDescription: true,
  rankValueSnapshot: true,
  notes: true,
  awardedAt: true,
  createdAt: true,
  updatedAt: true,
  award: { select: { id: true, name: true, businessRole: true } },
  profile: { select: { id: true, fullName: true, avatarUrl: true } },
  group: { select: { id: true, name: true } },
  awardedBy: { select: { id: true, fullName: true } },
};

export async function getAwardWinners(filters: { awardId?: string; period?: Date; profileId?: string }) {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const rows = await db.kpiAwardWinner.findMany({
    where: {
      ...(filters.awardId ? { awardId: filters.awardId } : {}),
      ...(filters.period ? { period: filters.period } : {}),
      ...(filters.profileId ? { profileId: filters.profileId } : {}),
    },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: awardWinnerRowSelect,
  });
  return toPlain(rows);
}

export type AwardWinnerRow = Awaited<ReturnType<typeof getAwardWinners>>[number];

// ─── KpiAward candidates (ranking suggestion, pola mirip getTopSalesByRecentBooking) ─

export interface KpiAwardCandidateRow {
  resultId: string;
  profileId: string;
  fullName: string | null;
  rankValue: number | null;
  totalBonus: number | null;
  netAmount: number | null;
  dealingAchievementPct: number | null;
  omsetAchievementPct: number | null;
}

export async function getKpiAwardCandidates(awardId: string, period: Date): Promise<KpiAwardCandidateRow[]> {
  "use cache";
  cacheTag("kpi-insentif", "bookings");
  cacheLife("seconds");

  const award = await db.kpiAward.findUnique({
    where: { id: awardId },
    select: { businessRole: true, isRanked: true, rankingMetric: true },
  });
  if (!award || !award.isRanked || !award.rankingMetric || award.rankingMetric === "manual") {
    return [];
  }

  // Scope candidates to the award's businessRole via active (non-draft) assignments
  // for the period — KpiCalculationResult itself does not store businessRole.
  let candidateProfileIds: string[] | undefined;
  if (award.businessRole) {
    const assignments = await db.kpiAssignment.findMany({
      where: { period, isDraft: false, kpiMaster: { businessRole: award.businessRole } },
      select: { profileId: true },
    });
    candidateProfileIds = [...new Set(assignments.map((a) => a.profileId))];
    if (candidateProfileIds.length === 0) return [];
  }

  const orderBy =
    award.rankingMetric === "totalBonus"
      ? { totalBonus: "desc" as const }
      : award.rankingMetric === "netAmount"
      ? { netAmount: "desc" as const }
      : award.rankingMetric === "dealingAchievementPct"
      ? { dealingAchievementPct: "desc" as const }
      : { omsetAchievementPct: "desc" as const };

  const results = await db.kpiCalculationResult.findMany({
    where: {
      period,
      ...(candidateProfileIds ? { profileId: { in: candidateProfileIds } } : {}),
    },
    orderBy,
    take: 10,
    select: {
      id: true,
      profileId: true,
      totalBonus: true,
      netAmount: true,
      dealingAchievementPct: true,
      omsetAchievementPct: true,
      profile: { select: { fullName: true } },
    },
  });

  const rankField = award.rankingMetric;
  return toPlain(
    results.map((r) => ({
      resultId: r.id,
      profileId: r.profileId,
      fullName: r.profile.fullName,
      rankValue: r[rankField as "totalBonus" | "netAmount" | "dealingAchievementPct" | "omsetAchievementPct"],
      totalBonus: r.totalBonus,
      netAmount: r.netAmount,
      dealingAchievementPct: r.dealingAchievementPct,
      omsetAchievementPct: r.omsetAchievementPct,
    }))
  ) as unknown as KpiAwardCandidateRow[];
}

// ─── KPI Saya Ringkas (Overview widget aggregator) ─────────────────────────────

export interface KpiSayaSummary {
  resultId: string;
  status: "DRAFT" | "SIMULATED" | "PENDING_REVIEW" | "FINALIZED";
  grade: string | null;
  netAmount: number | null;
  dealingAchievementPct: number | null;
  omsetAchievementPct: number | null;
  homebaseAchievementPct: number | null;
  stage1Total: number | null;
  stage1PaidAt: string | null;
  stage2Total: number | null;
  stage2PaidAt: string | null;
  awardsWon: { id: string; name: string; prizeDescription: string | null }[];
}

export async function getKpiSayaSummary(profileId: string, period: Date): Promise<KpiSayaSummary | null> {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("seconds");

  const result = await db.kpiCalculationResult.findFirst({
    where: { profileId, period },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      grade: true,
      netAmount: true,
      dealingAchievementPct: true,
      omsetAchievementPct: true,
      homebaseAchievementPct: true,
      stage1Total: true,
      stage1PaidAt: true,
      stage2Total: true,
      stage2PaidAt: true,
    },
  });
  if (!result) return null;

  const awardsWon = await db.kpiAwardWinner.findMany({
    where: { profileId, period },
    select: { id: true, prizeDescription: true, award: { select: { name: true } } },
    take: 10,
  });

  return toPlain({
    resultId: result.id,
    status: result.status,
    grade: result.grade,
    netAmount: result.netAmount,
    dealingAchievementPct: result.dealingAchievementPct,
    omsetAchievementPct: result.omsetAchievementPct,
    homebaseAchievementPct: result.homebaseAchievementPct,
    stage1Total: result.stage1Total,
    stage1PaidAt: result.stage1PaidAt,
    stage2Total: result.stage2Total,
    stage2PaidAt: result.stage2PaidAt,
    awardsWon: awardsWon.map((w) => ({
      id: w.id,
      name: w.award.name,
      prizeDescription: w.prizeDescription,
    })),
  }) as unknown as KpiSayaSummary;
}

/**
 * Gates the Overview "KPI Saya Ringkas" widget — true only when the profile has
 * a non-draft KPI assignment for the given period (Finance/Purchase/etc without
 * any KPI assignment should not see the widget at all).
 */
export async function hasActiveKpiAssignment(profileId: string, period: Date): Promise<boolean> {
  "use cache";
  cacheTag("kpi-insentif");
  cacheLife("minutes");

  const count = await db.kpiAssignment.count({
    where: { profileId, period, isDraft: false },
  });
  return count > 0;
}
