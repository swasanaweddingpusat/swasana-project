-- Daily Activity module (Phase 1: schema only)
-- Adds enum "ProgressStatus" and table "daily_activities".
-- Idempotent: safe to re-run.
--
-- Note: the OLD "DailyActivity" Prisma model (table "leads") was renamed to
-- "Lead" at the code level only in this change — no data migration, no DDL
-- needed for that table (still @@map("leads"), unchanged columns).

-- CreateEnum (guarded)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProgressStatus') THEN
    CREATE TYPE "ProgressStatus" AS ENUM ('COLD', 'WARM', 'HOT', 'FREEZE', 'DEAL', 'LOST');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_activities" (
    "id" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "companyName" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "sourceOfInformationId" TEXT NOT NULL,
    "bitrixId" TEXT,
    "contactName" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "location" TEXT,
    "siteVisitAt" TIMESTAMP(3),
    "milestone" TEXT NOT NULL,
    "progressStatus" "ProgressStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "daily_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_activities_salesId_idx" ON "daily_activities"("salesId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_activities_segmentId_idx" ON "daily_activities"("segmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_activities_sourceOfInformationId_idx" ON "daily_activities"("sourceOfInformationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_activities_activityDate_idx" ON "daily_activities"("activityDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_activities_progressStatus_idx" ON "daily_activities"("progressStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_activities_deletedAt_idx" ON "daily_activities"("deletedAt");

-- AddForeignKey (sales -> profiles)
ALTER TABLE "daily_activities" DROP CONSTRAINT IF EXISTS "daily_activities_salesId_fkey";
ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_salesId_fkey"
    FOREIGN KEY ("salesId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (segment -> lead_segments, i.e. DailyActivitySegment)
ALTER TABLE "daily_activities" DROP CONSTRAINT IF EXISTS "daily_activities_segmentId_fkey";
ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "lead_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (sourceOfInformation -> source_of_informations)
ALTER TABLE "daily_activities" DROP CONSTRAINT IF EXISTS "daily_activities_sourceOfInformationId_fkey";
ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_sourceOfInformationId_fkey"
    FOREIGN KEY ("sourceOfInformationId") REFERENCES "source_of_informations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
