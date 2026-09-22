-- Migration: add_kpi_insentif_module
-- KPI & Insentif module: master data, achievement schema/tiers,
-- commission policy, assignment, calculation results, policy snapshots.
-- All DDL is idempotent (IF NOT EXISTS / DO NOTHING).

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "KpiTargetType" AS ENUM ('qty', 'price');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "KpiIndicatorType" AS ENUM ('dealing', 'omset', 'homebase');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "KpiBusinessRole" AS ENUM ('sales', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "KpiTierAction" AS ENUM ('bonus', 'deduction', 'warning', 'under_performance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "KpiResultStatus" AS ENUM ('DRAFT', 'SIMULATED', 'PENDING_REVIEW', 'FINALIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── kpi_target_items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_target_items" (
  "id"               TEXT        NOT NULL DEFAULT '',
  "name"             TEXT        NOT NULL,
  "indicatorType"    "KpiIndicatorType" NOT NULL,
  "type"             "KpiTargetType"    NOT NULL,
  "qty"              INTEGER,
  "price"            DECIMAL(15,2),
  "qtyReguler"       INTEGER,
  "qtyHadjatan"      INTEGER,
  "priceReguler"     DECIMAL(15,2),
  "priceHadjatan"    DECIMAL(15,2),
  "regulerCategory"  "EventCategory",
  "hadjatanCategory" "EventCategory",
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_target_items_pkey" PRIMARY KEY ("id")
);

-- ── kpi_achievement_schemas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_achievement_schemas" (
  "id"                  TEXT        NOT NULL DEFAULT '',
  "name"                TEXT        NOT NULL,
  "description"         TEXT,
  "businessRole"        "KpiBusinessRole" NOT NULL,
  "isDraft"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "gatingMinIndicators" INTEGER,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_achievement_schemas_pkey" PRIMARY KEY ("id")
);

-- ── kpi_achievement_tiers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_achievement_tiers" (
  "id"                  TEXT        NOT NULL DEFAULT '',
  "achievementSchemaId" TEXT        NOT NULL,
  "sortOrder"           INTEGER     NOT NULL DEFAULT 0,
  "label"               TEXT        NOT NULL,
  "lowerBound"          DECIMAL(8,4) NOT NULL,
  "upperBound"          DECIMAL(8,4),
  "lowerInclusive"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "upperInclusive"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "isDraftBounds"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "actionType"          "KpiTierAction" NOT NULL,
  "dealingBonus"        DECIMAL(15,2),
  "omsetBonus"          DECIMAL(15,2),
  "homebaseBonus"       DECIMAL(15,2),
  "deductionPct"        DECIMAL(5,2),
  "isWarningFlag"       BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_achievement_tiers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_achievement_tiers_achievementSchemaId_idx"
  ON "kpi_achievement_tiers"("achievementSchemaId");

ALTER TABLE "kpi_achievement_tiers"
  DROP CONSTRAINT IF EXISTS "kpi_achievement_tiers_achievementSchemaId_fkey";
ALTER TABLE "kpi_achievement_tiers"
  ADD CONSTRAINT "kpi_achievement_tiers_achievementSchemaId_fkey"
  FOREIGN KEY ("achievementSchemaId")
  REFERENCES "kpi_achievement_schemas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── kpi_masters ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_masters" (
  "id"                  TEXT        NOT NULL DEFAULT '',
  "name"                TEXT        NOT NULL,
  "description"         TEXT,
  "month"               DATE        NOT NULL,
  "businessRole"        "KpiBusinessRole" NOT NULL,
  "isDraft"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "targetItemId"        TEXT        NOT NULL,
  "achievementSchemaId" TEXT        NOT NULL,
  "createdById"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_masters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_masters_month_idx" ON "kpi_masters"("month");
CREATE INDEX IF NOT EXISTS "kpi_masters_businessRole_idx" ON "kpi_masters"("businessRole");
CREATE INDEX IF NOT EXISTS "kpi_masters_targetItemId_idx" ON "kpi_masters"("targetItemId");

ALTER TABLE "kpi_masters"
  DROP CONSTRAINT IF EXISTS "kpi_masters_targetItemId_fkey";
ALTER TABLE "kpi_masters"
  ADD CONSTRAINT "kpi_masters_targetItemId_fkey"
  FOREIGN KEY ("targetItemId")
  REFERENCES "kpi_target_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_masters"
  DROP CONSTRAINT IF EXISTS "kpi_masters_achievementSchemaId_fkey";
ALTER TABLE "kpi_masters"
  ADD CONSTRAINT "kpi_masters_achievementSchemaId_fkey"
  FOREIGN KEY ("achievementSchemaId")
  REFERENCES "kpi_achievement_schemas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_masters"
  DROP CONSTRAINT IF EXISTS "kpi_masters_createdById_fkey";
ALTER TABLE "kpi_masters"
  ADD CONSTRAINT "kpi_masters_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── kpi_commission_policies ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_commission_policies" (
  "id"              TEXT        NOT NULL DEFAULT '',
  "name"            TEXT        NOT NULL,
  "description"     TEXT,
  "businessRole"    "KpiBusinessRole" NOT NULL,
  "isDraft"         BOOLEAN     NOT NULL DEFAULT TRUE,
  "nominalPerDeal"  DECIMAL(15,2),
  "pctOfRevenue"    DECIMAL(5,4),
  "packageCategory" "EventCategory",
  "effectiveFrom"   DATE,
  "effectiveTo"     DATE,
  "approvedById"    TEXT,
  "approvedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_commission_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_commission_policies_businessRole_idx"
  ON "kpi_commission_policies"("businessRole");

ALTER TABLE "kpi_commission_policies"
  DROP CONSTRAINT IF EXISTS "kpi_commission_policies_approvedById_fkey";
ALTER TABLE "kpi_commission_policies"
  ADD CONSTRAINT "kpi_commission_policies_approvedById_fkey"
  FOREIGN KEY ("approvedById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── kpi_assignments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_assignments" (
  "id"          TEXT        NOT NULL DEFAULT '',
  "kpiMasterId" TEXT        NOT NULL,
  "profileId"   TEXT        NOT NULL,
  "venueId"     TEXT,
  "period"      DATE        NOT NULL,
  "targetQty"   INTEGER,
  "targetPrice" DECIMAL(15,2),
  "isDraft"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "kpi_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_assignments_kpiMasterId_profileId_period_key"
  ON "kpi_assignments"("kpiMasterId", "profileId", "period");
CREATE INDEX IF NOT EXISTS "kpi_assignments_profileId_idx" ON "kpi_assignments"("profileId");
CREATE INDEX IF NOT EXISTS "kpi_assignments_period_idx" ON "kpi_assignments"("period");
CREATE INDEX IF NOT EXISTS "kpi_assignments_kpiMasterId_idx" ON "kpi_assignments"("kpiMasterId");

ALTER TABLE "kpi_assignments"
  DROP CONSTRAINT IF EXISTS "kpi_assignments_kpiMasterId_fkey";
ALTER TABLE "kpi_assignments"
  ADD CONSTRAINT "kpi_assignments_kpiMasterId_fkey"
  FOREIGN KEY ("kpiMasterId")
  REFERENCES "kpi_masters"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_assignments"
  DROP CONSTRAINT IF EXISTS "kpi_assignments_profileId_fkey";
ALTER TABLE "kpi_assignments"
  ADD CONSTRAINT "kpi_assignments_profileId_fkey"
  FOREIGN KEY ("profileId")
  REFERENCES "profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_assignments"
  DROP CONSTRAINT IF EXISTS "kpi_assignments_venueId_fkey";
ALTER TABLE "kpi_assignments"
  ADD CONSTRAINT "kpi_assignments_venueId_fkey"
  FOREIGN KEY ("venueId")
  REFERENCES "venues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_assignments"
  DROP CONSTRAINT IF EXISTS "kpi_assignments_createdById_fkey";
ALTER TABLE "kpi_assignments"
  ADD CONSTRAINT "kpi_assignments_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── kpi_policy_snapshots ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_policy_snapshots" (
  "id"           TEXT        NOT NULL DEFAULT '',
  "snapshotData" JSONB       NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"  TEXT,
  CONSTRAINT "kpi_policy_snapshots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "kpi_policy_snapshots"
  DROP CONSTRAINT IF EXISTS "kpi_policy_snapshots_createdById_fkey";
ALTER TABLE "kpi_policy_snapshots"
  ADD CONSTRAINT "kpi_policy_snapshots_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── kpi_calculation_results ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_calculation_results" (
  "id"                       TEXT        NOT NULL DEFAULT '',
  "profileId"                TEXT        NOT NULL,
  "venueId"                  TEXT,
  "period"                   DATE        NOT NULL,
  "realDealingTotal"         INTEGER,
  "realDealingReguler"       INTEGER,
  "realDealingHadjatan"      INTEGER,
  "realOmsetTotal"           DECIMAL(15,2),
  "realOmsetReguler"         DECIMAL(15,2),
  "realOmsetHadjatan"        DECIMAL(15,2),
  "realHomebase"             INTEGER,
  "targetDealingTotal"       INTEGER,
  "targetOmsetTotal"         DECIMAL(15,2),
  "targetHomebase"           INTEGER,
  "dealingAchievementPct"    DECIMAL(8,4),
  "omsetAchievementPct"      DECIMAL(8,4),
  "homebaseAchievementPct"   DECIMAL(8,4),
  "dealingTierId"            TEXT,
  "omsetTierId"              TEXT,
  "homebaseTierId"           TEXT,
  "dealingBonus"             DECIMAL(15,2),
  "omsetBonus"               DECIMAL(15,2),
  "homebaseBonus"            DECIMAL(15,2),
  "totalBonus"               DECIMAL(15,2),
  "baseCommissionReguler"    DECIMAL(15,2),
  "baseCommissionHadjatan"   DECIMAL(15,2),
  "baseCommissionTotal"      DECIMAL(15,2),
  "deductionTriggerIndicator" TEXT,
  "deductionPct"             DECIMAL(5,2),
  "deductionAmount"          DECIMAL(15,2),
  "grossAmount"              DECIMAL(15,2),
  "netAmount"                DECIMAL(15,2),
  "status"                   "KpiResultStatus" NOT NULL DEFAULT 'DRAFT',
  "policySnapshotId"         TEXT,
  "missingDataReasons"       TEXT[]      NOT NULL DEFAULT '{}',
  "grade"                    TEXT,
  "calculatedAt"             TIMESTAMP(3),
  "finalizedAt"              TIMESTAMP(3),
  "finalizedById"            TEXT,
  "notes"                    TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_calculation_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_calculation_results_profileId_period_venueId_key"
  ON "kpi_calculation_results"("profileId", "period", "venueId");
CREATE INDEX IF NOT EXISTS "kpi_calculation_results_profileId_idx" ON "kpi_calculation_results"("profileId");
CREATE INDEX IF NOT EXISTS "kpi_calculation_results_period_idx" ON "kpi_calculation_results"("period");
CREATE INDEX IF NOT EXISTS "kpi_calculation_results_status_idx" ON "kpi_calculation_results"("status");

ALTER TABLE "kpi_calculation_results"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_results_profileId_fkey";
ALTER TABLE "kpi_calculation_results"
  ADD CONSTRAINT "kpi_calculation_results_profileId_fkey"
  FOREIGN KEY ("profileId")
  REFERENCES "profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_calculation_results"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_results_venueId_fkey";
ALTER TABLE "kpi_calculation_results"
  ADD CONSTRAINT "kpi_calculation_results_venueId_fkey"
  FOREIGN KEY ("venueId")
  REFERENCES "venues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_calculation_results"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_results_policySnapshotId_fkey";
ALTER TABLE "kpi_calculation_results"
  ADD CONSTRAINT "kpi_calculation_results_policySnapshotId_fkey"
  FOREIGN KEY ("policySnapshotId")
  REFERENCES "kpi_policy_snapshots"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_calculation_results"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_results_finalizedById_fkey";
ALTER TABLE "kpi_calculation_results"
  ADD CONSTRAINT "kpi_calculation_results_finalizedById_fkey"
  FOREIGN KEY ("finalizedById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── kpi_calculation_details ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_calculation_details" (
  "id"             TEXT        NOT NULL DEFAULT '',
  "resultId"       TEXT        NOT NULL,
  "indicatorType"  "KpiIndicatorType" NOT NULL,
  "targetValue"    DECIMAL(15,2),
  "realValue"      DECIMAL(15,2),
  "achievementPct" DECIMAL(8,4),
  "tierId"         TEXT,
  "tierLabel"      TEXT,
  "actionType"     "KpiTierAction",
  "bonusAmount"    DECIMAL(15,2),
  "deductionPct"   DECIMAL(5,2),
  "isGatingFailed" BOOLEAN     NOT NULL DEFAULT FALSE,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_calculation_details_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_calculation_details_resultId_idx"
  ON "kpi_calculation_details"("resultId");

ALTER TABLE "kpi_calculation_details"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_details_resultId_fkey";
ALTER TABLE "kpi_calculation_details"
  ADD CONSTRAINT "kpi_calculation_details_resultId_fkey"
  FOREIGN KEY ("resultId")
  REFERENCES "kpi_calculation_results"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
