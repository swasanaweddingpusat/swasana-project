-- Revert the stray "weekly work assignment" rename so the DB matches schema.prisma
-- and the application code, which BOTH use `effectiveDate` + `endDate` (never
-- `weekStartDate`). Migration 20260629000000_weekly_work_assignment renamed
-- effectiveDate -> weekStartDate and dropped endDate, but that change was never
-- reflected in the schema or code (it arrived via a "placeholder migrations to
-- resolve branch divergence" commit). The result was a runtime drift:
--   Invalid `prisma.employeeWorkAssignment.findMany()` — column `effectiveDate` does not exist.
-- This migration undoes that drift idempotently.

-- 1. Rename weekStartDate -> effectiveDate (only if the drift is present)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_work_assignments' AND column_name = 'weekStartDate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_work_assignments' AND column_name = 'effectiveDate'
  ) THEN
    ALTER TABLE "employee_work_assignments" RENAME COLUMN "weekStartDate" TO "effectiveDate";
  END IF;
END $$;

-- 2. Restore endDate (nullable) — dropped by the weekly migration
ALTER TABLE "employee_work_assignments" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

-- 3. Swap the unique constraint back: (profileId, weekStartDate) -> (profileId, workLocationId, workShiftId)
-- The weekly migration created the uniqueness as a CONSTRAINT, so it must be
-- dropped with DROP CONSTRAINT (DROP INDEX fails: the index backs a constraint).
ALTER TABLE "employee_work_assignments"
  DROP CONSTRAINT IF EXISTS "employee_work_assignments_profileId_weekStartDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "employee_work_assignments_profileId_workLocationId_workShiftId_key"
  ON "employee_work_assignments"("profileId", "workLocationId", "workShiftId");

-- 4. Drop the weekStartDate index (its column is gone after the rename)
DROP INDEX IF EXISTS "employee_work_assignments_weekStartDate_idx";

-- NOTE: `offdayDays` (added by 20260702120000) is intentionally left in place. It
-- is not declared in schema.prisma nor referenced by code, so it is a harmless
-- extra column; dropping it here would risk data loss if it is used elsewhere.
