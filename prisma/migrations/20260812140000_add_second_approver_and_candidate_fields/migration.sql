-- ─── Second Approver + Candidate Fields ─────────────────────────────────────
-- Adds sequential two-approver workflow to job_postings (slot 2),
-- and expectedSalary + viewed columns to candidates.

-- AlterTable job_postings: add second approver slot columns
ALTER TABLE "job_postings"
  ADD COLUMN IF NOT EXISTS "approver2Id"     TEXT,
  ADD COLUMN IF NOT EXISTS "approvalStatus2" "JobPostingApprovalStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "approvedBy2Id"   TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt2"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalNote2"   TEXT;

-- AddForeignKey: approver2Id (drop-before-add for idempotency)
ALTER TABLE "job_postings" DROP CONSTRAINT IF EXISTS "job_postings_approver2Id_fkey";
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_approver2Id_fkey"
  FOREIGN KEY ("approver2Id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: approvedBy2Id
ALTER TABLE "job_postings" DROP CONSTRAINT IF EXISTS "job_postings_approvedBy2Id_fkey";
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_approvedBy2Id_fkey"
  FOREIGN KEY ("approvedBy2Id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for second approver slot
CREATE INDEX IF NOT EXISTS "job_postings_approver2Id_idx"     ON "job_postings"("approver2Id");
CREATE INDEX IF NOT EXISTS "job_postings_approvalStatus2_idx" ON "job_postings"("approvalStatus2");

-- AlterTable candidates: add expectedSalary and viewed columns
ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "expectedSalary" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "viewed"         BOOLEAN NOT NULL DEFAULT false;
