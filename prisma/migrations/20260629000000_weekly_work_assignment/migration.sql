-- Migration: Change EmployeeWorkAssignment from date-range to per-week (Monday–Sunday)
-- NOTE: columns use camelCase quoting as created by Prisma on this project
--
-- Made fully idempotent so an interrupted deploy (container killed mid-migrate,
-- the exact cause of a P3009 crash-loop) can be re-run cleanly after
-- `migrate resolve --rolled-back` — without manual SQL surgery to repair a
-- half-applied state. Each step guards against its effect already being present.

-- 1. Drop old unique index on (profileId, workLocationId, workShiftId)
DROP INDEX IF EXISTS "employee_work_assignments_profileId_workLocationId_workShiftId_key";

-- 2. Rename "effectiveDate" → "weekStartDate" (only if not already renamed)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_work_assignments' AND column_name = 'effectiveDate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_work_assignments' AND column_name = 'weekStartDate'
  ) THEN
    ALTER TABLE "employee_work_assignments" RENAME COLUMN "effectiveDate" TO "weekStartDate";
  END IF;
END $$;

-- 3. Drop "endDate" (no longer stored; always computed as weekStartDate + 6 days)
ALTER TABLE "employee_work_assignments" DROP COLUMN IF EXISTS "endDate";

-- 4. Add new unique constraint: one assignment per employee per week
DO $$ BEGIN
  ALTER TABLE "employee_work_assignments"
    ADD CONSTRAINT "employee_work_assignments_profileId_weekStartDate_key"
    UNIQUE ("profileId", "weekStartDate");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Add index on weekStartDate for filtering by week
CREATE INDEX IF NOT EXISTS "employee_work_assignments_weekStartDate_idx"
  ON "employee_work_assignments"("weekStartDate");
