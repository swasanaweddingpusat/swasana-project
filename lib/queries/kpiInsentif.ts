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
  profile: { select: { id: true, fullName: true } },
  venue: { select: { id: true, name: true } },
  finalizedBy: { select: { id: true, fullName: true } },
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
