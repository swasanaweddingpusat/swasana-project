-- Add mobile attendance fields to employee_work_assignments
ALTER TABLE "employee_work_assignments" ADD COLUMN IF NOT EXISTS "isMobileAttendance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employee_work_assignments" ADD COLUMN IF NOT EXISTS "clockInLocationId" TEXT;
ALTER TABLE "employee_work_assignments" ADD COLUMN IF NOT EXISTS "clockOutLocationId" TEXT;

CREATE INDEX IF NOT EXISTS "employee_work_assignments_clockInLocationId_idx" ON "employee_work_assignments"("clockInLocationId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_clockOutLocationId_idx" ON "employee_work_assignments"("clockOutLocationId");

ALTER TABLE "employee_work_assignments" DROP CONSTRAINT IF EXISTS "employee_work_assignments_clockInLocationId_fkey";
ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_clockInLocationId_fkey" FOREIGN KEY ("clockInLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_work_assignments" DROP CONSTRAINT IF EXISTS "employee_work_assignments_clockOutLocationId_fkey";
ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_clockOutLocationId_fkey" FOREIGN KEY ("clockOutLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
