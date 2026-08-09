-- CreateEnum (PostgreSQL tidak support IF NOT EXISTS untuk TYPE, gunakan DO block)
DO $$ BEGIN
  CREATE TYPE "PositionLevel" AS ENUM ('entry', 'junior', 'mid', 'senior', 'lead', 'manager', 'director');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InterviewLocationType" AS ENUM ('online', 'offline', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable job_postings
ALTER TABLE "job_postings"
  ADD COLUMN IF NOT EXISTS "isWalkInInterview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "brandId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interviewDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "level" "PositionLevel",
  ADD COLUMN IF NOT EXISTS "quota" INTEGER,
  ADD COLUMN IF NOT EXISTS "interviewLocation" "InterviewLocationType",
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "minEducation" TEXT,
  ADD COLUMN IF NOT EXISTS "minExperience" TEXT,
  ADD COLUMN IF NOT EXISTS "otherQualifications" TEXT,
  ADD COLUMN IF NOT EXISTS "jobDescriptions" JSONB,
  ADD COLUMN IF NOT EXISTS "additionalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "approverId" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedBySignature" TEXT;

-- AddForeignKey
ALTER TABLE "job_postings" DROP CONSTRAINT IF EXISTS "job_postings_brandId_fkey";
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_postings" DROP CONSTRAINT IF EXISTS "job_postings_approverId_fkey";
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_postings_brandId_idx" ON "job_postings"("brandId");
CREATE INDEX IF NOT EXISTS "job_postings_approverId_idx" ON "job_postings"("approverId");
