-- Migration: add_kpi_staged_payment_overachievement_awards
-- KPI & Insentif additive features: staged bonus payment (Tahap 1/2),
-- over-achievement bonus, and awards/best-performer (non-cash prizes).
-- All DDL is idempotent (IF NOT EXISTS / DO NOTHING).

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "KpiAwardRankingMetric" AS ENUM ('totalBonus', 'netAmount', 'dealingAchievementPct', 'omsetAchievementPct', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── kpi_achievement_schemas: staged payment config ─────────────────────────────

ALTER TABLE "kpi_achievement_schemas" ADD COLUMN IF NOT EXISTS "stagedPaymentEnabled"    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "kpi_achievement_schemas" ADD COLUMN IF NOT EXISTS "stage1PayoutPct"         DECIMAL(5,2);
ALTER TABLE "kpi_achievement_schemas" ADD COLUMN IF NOT EXISTS "stage2PayoutPct"         DECIMAL(5,2);
ALTER TABLE "kpi_achievement_schemas" ADD COLUMN IF NOT EXISTS "stage1MinClientPayment"  INTEGER DEFAULT 30000000;
ALTER TABLE "kpi_achievement_schemas" ADD COLUMN IF NOT EXISTS "stage2PayoutMonthOffset" INTEGER DEFAULT 1;

-- ── kpi_commission_policies: over-achievement config ────────────────────────────

ALTER TABLE "kpi_commission_policies" ADD COLUMN IF NOT EXISTS "overAchievementNominalPerExtraDeal" DECIMAL(15,2);
ALTER TABLE "kpi_commission_policies" ADD COLUMN IF NOT EXISTS "overAchievementPctOfExtraRevenue"   DECIMAL(5,4);

-- ── kpi_calculation_results: over-achievement + staged payment tracking ────────

ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "overAchievementDealingBonus" DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "overAchievementOmsetBonus"   DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "overAchievementTotal"        DECIMAL(15,2);

ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage1Total"          DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage2Total"          DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage1EligibleAmount" DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage2AdjustedAmount" DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage2ClawbackAmount" DECIMAL(15,2);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage1PaidAt"         TIMESTAMP(3);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage2PaidAt"         TIMESTAMP(3);
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage1PaidById"       TEXT;
ALTER TABLE "kpi_calculation_results" ADD COLUMN IF NOT EXISTS "stage2PaidById"       TEXT;

ALTER TABLE "kpi_calculation_results"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_results_stage1PaidById_fkey";
ALTER TABLE "kpi_calculation_results"
  ADD CONSTRAINT "kpi_calculation_results_stage1PaidById_fkey"
  FOREIGN KEY ("stage1PaidById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_calculation_results"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_results_stage2PaidById_fkey";
ALTER TABLE "kpi_calculation_results"
  ADD CONSTRAINT "kpi_calculation_results_stage2PaidById_fkey"
  FOREIGN KEY ("stage2PaidById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── kpi_calculation_deal_links ───────────────────────────────────────────────────
--
-- Breakdown per-booking of staged-payment shares, so Tahap 2 clawback can be
-- re-evaluated against the LIVE booking status at payout time (not frozen at
-- calculation time).

CREATE TABLE IF NOT EXISTS "kpi_calculation_deal_links" (
  "id"             TEXT           NOT NULL DEFAULT '',
  "resultId"       TEXT           NOT NULL,
  "bookingId"      TEXT           NOT NULL,
  "dealAmount"     DECIMAL(15,2)  NOT NULL,
  "category"       "EventCategory" NOT NULL,
  "stage1Share"    DECIMAL(15,2),
  "stage2Share"    DECIMAL(15,2),
  "stage1Eligible" BOOLEAN        NOT NULL DEFAULT FALSE,
  "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_calculation_deal_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_calculation_deal_links_resultId_bookingId_key"
  ON "kpi_calculation_deal_links"("resultId", "bookingId");
CREATE INDEX IF NOT EXISTS "kpi_calculation_deal_links_resultId_idx" ON "kpi_calculation_deal_links"("resultId");
CREATE INDEX IF NOT EXISTS "kpi_calculation_deal_links_bookingId_idx" ON "kpi_calculation_deal_links"("bookingId");

ALTER TABLE "kpi_calculation_deal_links"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_deal_links_resultId_fkey";
ALTER TABLE "kpi_calculation_deal_links"
  ADD CONSTRAINT "kpi_calculation_deal_links_resultId_fkey"
  FOREIGN KEY ("resultId")
  REFERENCES "kpi_calculation_results"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kpi_calculation_deal_links"
  DROP CONSTRAINT IF EXISTS "kpi_calculation_deal_links_bookingId_fkey";
ALTER TABLE "kpi_calculation_deal_links"
  ADD CONSTRAINT "kpi_calculation_deal_links_bookingId_fkey"
  FOREIGN KEY ("bookingId")
  REFERENCES "bookings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── kpi_awards / kpi_award_winners ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kpi_awards" (
  "id"                      TEXT             NOT NULL DEFAULT '',
  "name"                    TEXT             NOT NULL,
  "description"             TEXT,
  "businessRole"            "KpiBusinessRole",
  "isRanked"                BOOLEAN          NOT NULL DEFAULT TRUE,
  "rankingMetric"           "KpiAwardRankingMetric",
  "defaultPrizeDescription" TEXT,
  "isActive"                BOOLEAN          NOT NULL DEFAULT TRUE,
  "createdAt"               TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "kpi_awards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_awards_businessRole_idx" ON "kpi_awards"("businessRole");

CREATE TABLE IF NOT EXISTS "kpi_award_winners" (
  "id"                TEXT         NOT NULL DEFAULT '',
  "awardId"           TEXT         NOT NULL,
  "period"            DATE         NOT NULL,
  "profileId"         TEXT,
  "groupId"           TEXT,
  "prizeDescription"  TEXT,
  "rankValueSnapshot" DECIMAL(15,4),
  "notes"             TEXT,
  "awardedById"       TEXT,
  "awardedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_award_winners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kpi_award_winners_awardId_idx" ON "kpi_award_winners"("awardId");
CREATE INDEX IF NOT EXISTS "kpi_award_winners_period_idx" ON "kpi_award_winners"("period");
CREATE INDEX IF NOT EXISTS "kpi_award_winners_profileId_idx" ON "kpi_award_winners"("profileId");
CREATE INDEX IF NOT EXISTS "kpi_award_winners_groupId_idx" ON "kpi_award_winners"("groupId");

ALTER TABLE "kpi_award_winners"
  DROP CONSTRAINT IF EXISTS "kpi_award_winners_awardId_fkey";
ALTER TABLE "kpi_award_winners"
  ADD CONSTRAINT "kpi_award_winners_awardId_fkey"
  FOREIGN KEY ("awardId")
  REFERENCES "kpi_awards"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_award_winners"
  DROP CONSTRAINT IF EXISTS "kpi_award_winners_profileId_fkey";
ALTER TABLE "kpi_award_winners"
  ADD CONSTRAINT "kpi_award_winners_profileId_fkey"
  FOREIGN KEY ("profileId")
  REFERENCES "profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_award_winners"
  DROP CONSTRAINT IF EXISTS "kpi_award_winners_groupId_fkey";
ALTER TABLE "kpi_award_winners"
  ADD CONSTRAINT "kpi_award_winners_groupId_fkey"
  FOREIGN KEY ("groupId")
  REFERENCES "user_groups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kpi_award_winners"
  DROP CONSTRAINT IF EXISTS "kpi_award_winners_awardedById_fkey";
ALTER TABLE "kpi_award_winners"
  ADD CONSTRAINT "kpi_award_winners_awardedById_fkey"
  FOREIGN KEY ("awardedById")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
