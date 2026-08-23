-- ─── Job Posting Approval ────────────────────────────────────────────────────
-- Adds director-approval workflow to job_postings:
--   approvalStatus (pending/approved/rejected), approvedById, approvedAt, approvalNote
-- Plus the hr-recruitment:approve permission.

-- CreateEnum: JobPostingApprovalStatus (idempotent)
DO $$ BEGIN
  CREATE TYPE "JobPostingApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable job_postings: add approval columns
ALTER TABLE "job_postings"
  ADD COLUMN IF NOT EXISTS "approvalStatus" "JobPostingApprovalStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT;

-- AddForeignKey (drop-before-add for idempotency)
ALTER TABLE "job_postings" DROP CONSTRAINT IF EXISTS "job_postings_approvedById_fkey";
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_postings_approvalStatus_idx" ON "job_postings"("approvalStatus");

-- ─── Seed: hr-recruitment:approve permission ─────────────────────────────────
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-recruitment', 'approve', 'Approve or reject job postings', 25)
ON CONFLICT (module, action) DO NOTHING;

-- Grant hr-recruitment:approve to human-resource role
DO $$
DECLARE
  hr_role_id text;
BEGIN
  SELECT id INTO hr_role_id FROM "roles" WHERE name = 'human-resource';
  IF hr_role_id IS NULL THEN
    RAISE NOTICE 'human-resource role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), hr_role_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'hr-recruitment' AND p.action = 'approve'
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;

-- Grant hr-recruitment:approve to manager role
DO $$
DECLARE
  mgr_id text;
BEGIN
  SELECT id INTO mgr_id FROM "roles" WHERE name = 'manager';
  IF mgr_id IS NULL THEN
    RAISE NOTICE 'manager role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), mgr_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'hr-recruitment' AND p.action = 'approve'
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;
