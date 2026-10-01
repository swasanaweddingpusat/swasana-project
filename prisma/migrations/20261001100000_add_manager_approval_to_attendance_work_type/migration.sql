ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeApproverId" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeManagerApprovedBy" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeManagerApprovedAt" TIMESTAMP(3);
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeManagerNote" TEXT;

CREATE INDEX IF NOT EXISTS "attendances_workTypeApproverId_idx" ON "attendances"("workTypeApproverId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendances_workTypeApproverId_fkey') THEN
    ALTER TABLE "attendances"
      ADD CONSTRAINT "attendances_workTypeApproverId_fkey"
      FOREIGN KEY ("workTypeApproverId") REFERENCES "profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendances_workTypeManagerApprovedBy_fkey') THEN
    ALTER TABLE "attendances"
      ADD CONSTRAINT "attendances_workTypeManagerApprovedBy_fkey"
      FOREIGN KEY ("workTypeManagerApprovedBy") REFERENCES "profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'WorkTypeApprovalStatus' AND e.enumlabel = 'manager_approved'
  ) THEN
    ALTER TYPE "WorkTypeApprovalStatus" ADD VALUE 'manager_approved';
  END IF;
END $$;
