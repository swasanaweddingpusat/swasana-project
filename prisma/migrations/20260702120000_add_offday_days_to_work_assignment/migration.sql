-- AlterTable
ALTER TABLE "employee_work_assignments"
ADD COLUMN IF NOT EXISTS "offdayDays" integer[] NOT NULL DEFAULT ARRAY[]::integer[];
