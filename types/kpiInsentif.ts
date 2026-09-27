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
    dealingQty: number | null;
    omsetPrice: string | null;
    homebaseQty: number | null;
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
    targetItem: {
      name: string;
      dealingQty: number | null;
      omsetPrice: string | null;
      homebaseQty: number | null;
    };
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
  // ── Over-achievement bonus (additive, null = policy tidak dikonfigurasi) ────
  overAchievementDealingBonus: string | null;
  overAchievementOmsetBonus: string | null;
  overAchievementTotal: string | null;
  // ── Pembayaran bertahap (additive, null = fitur tidak aktif) ────────────────
  stage1Total: string | null;
  stage2Total: string | null;
  stage1EligibleAmount: string | null;
  stage2AdjustedAmount: string | null;
  stage2ClawbackAmount: string | null;
  stage1PaidAt: string | null;
  stage2PaidAt: string | null;
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
  stage1PaidBy: {
    id: string;
    fullName: string | null;
  } | null;
  stage2PaidBy: {
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

// ─── KpiAward / KpiAwardWinner ──────────────────────────────────────────────────

export type KpiAwardRankingMetric =
  | "totalBonus"
  | "netAmount"
  | "dealingAchievementPct"
  | "omsetAchievementPct"
  | "manual";

export interface KpiAwardWinnerItem {
  id: string;
  awardId: string;
  period: string;
  profileId: string | null;
  groupId: string | null;
  prizeDescription: string | null;
  rankValueSnapshot: string | null;
  notes: string | null;
  awardedAt: string;
  createdAt: string;
  updatedAt: string;
  award: {
    id: string;
    name: string;
    businessRole: KpiBusinessRole | null;
  };
  profile: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  group: {
    id: string;
    name: string;
  } | null;
  awardedBy: {
    id: string;
    fullName: string | null;
  } | null;
}

export interface KpiAwardCandidateItem {
  resultId: string;
  profileId: string;
  fullName: string | null;
  rankValue: number | null;
  totalBonus: number | null;
  netAmount: number | null;
  dealingAchievementPct: number | null;
  omsetAchievementPct: number | null;
}
