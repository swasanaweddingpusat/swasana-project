export type KpiTargetType = "qty" | "price";
export type KpiIndicatorType = "dealing" | "omset" | "homebase";
export type KpiBusinessRole = "sales" | "manager";
export type KpiResultStatus = "DRAFT" | "SIMULATED" | "PENDING_REVIEW" | "FINALIZED";

export interface KpiMasterItem {
  id: string;
  name: string;
  description: string | null;
  month: string;
  businessRole: KpiBusinessRole;
  isDraft: boolean;
  targetItemId: string;
  achievementSchemaId: string;
  createdAt: string;
  updatedAt: string;
  targetItem: {
    id: string;
    name: string;
    indicatorType: KpiIndicatorType;
    type: KpiTargetType;
  };
  achievementSchema: {
    id: string;
    name: string;
    businessRole: KpiBusinessRole;
  };
  createdBy: {
    id: string;
    fullName: string | null;
  } | null;
}

export interface KpiAssignmentItem {
  id: string;
  kpiMasterId: string;
  profileId: string;
  venueId: string | null;
  period: string;
  targetQty: number | null;
  targetPrice: string | null;
  isDraft: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  kpiMaster: {
    id: string;
    name: string;
    businessRole: KpiBusinessRole;
<<<<<<< HEAD
    targetItem: {
      name: string;
      indicatorType: KpiIndicatorType;
      type: KpiTargetType;
    };
=======
>>>>>>> origin/main
  };
  profile: {
    id: string;
    fullName: string | null;
  };
  venue: {
    id: string;
    name: string;
  } | null;
}

export interface KpiCalculationResultItem {
  id: string;
  profileId: string;
  venueId: string | null;
  period: string;
  realDealingTotal: number | null;
  realOmsetTotal: string | null;
  realHomebase: number | null;
  targetDealingTotal: number | null;
  targetOmsetTotal: string | null;
  targetHomebase: number | null;
  dealingAchievementPct: string | null;
  omsetAchievementPct: string | null;
  homebaseAchievementPct: string | null;
  totalBonus: string | null;
  baseCommissionTotal: string | null;
  deductionAmount: string | null;
  grossAmount: string | null;
  netAmount: string | null;
  status: KpiResultStatus;
  grade: string | null;
  missingDataReasons: string[];
  calculatedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    id: string;
    fullName: string | null;
  };
  venue: {
    id: string;
    name: string;
  } | null;
  finalizedBy: {
    id: string;
    fullName: string | null;
  } | null;
}

export interface ProfileForAssignment {
  id: string;
  fullName: string | null;
  roleName: string | null;
  venueId: string | null;
  venueName: string | null;
}
