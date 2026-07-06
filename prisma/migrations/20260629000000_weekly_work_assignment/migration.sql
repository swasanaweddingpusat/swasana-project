-- Migration: Change EmployeeWorkAssignment from date-range to per-week (Monday–Sunday)
-- NOTE: columns use camelCase quoting as created by Prisma on this project

-- 1. Drop old unique index on (profileId, workLocationId, workShiftId)
DROP INDEX IF EXISTS "employee_work_assignments_profileId_workLocationId_workShiftId_key";

-- 2. Rename "effectiveDate" → "weekStartDate"
ALTER TABLE "employee_work_assignments" RENAME COLUMN "effectiveDate" TO "weekStartDate";

-- 3. Drop "endDate" (no longer stored; always computed as weekStartDate + 6 days)
ALTER TABLE "employee_work_assignments" DROP COLUMN IF EXISTS "endDate";

-- 4. Add new unique constraint: one assignment per employee per week
ALTER TABLE "employee_work_assignments"
  ADD CONSTRAINT "employee_work_assignments_profileId_weekStartDate_key"
  UNIQUE ("profileId", "weekStartDate");

-- 5. Add index on weekStartDate for filtering by week
CREATE INDEX IF NOT EXISTS "employee_work_assignments_weekStartDate_idx"
  ON "employee_work_assignments"("weekStartDate");
