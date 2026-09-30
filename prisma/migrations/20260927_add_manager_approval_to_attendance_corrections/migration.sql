ALTER TABLE "attendance_corrections" ADD COLUMN IF NOT EXISTS "approverId" TEXT;
ALTER TABLE "attendance_corrections" ADD COLUMN IF NOT EXISTS "managerApprovedBy" TEXT;
ALTER TABLE "attendance_corrections" ADD COLUMN IF NOT EXISTS "managerApprovedAt" TIMESTAMP(3);
ALTER TABLE "attendance_corrections" ADD COLUMN IF NOT EXISTS "managerNote" TEXT;

CREATE INDEX IF NOT EXISTS "attendance_corrections_approverId_idx" ON "attendance_corrections"("approverId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_corrections_approverId_fkey') THEN
    ALTER TABLE "attendance_corrections"
      ADD CONSTRAINT "attendance_corrections_approverId_fkey"
      FOREIGN KEY ("approverId") REFERENCES "profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_corrections_managerApprovedBy_fkey') THEN
    ALTER TABLE "attendance_corrections"
      ADD CONSTRAINT "attendance_corrections_managerApprovedBy_fkey"
      FOREIGN KEY ("managerApprovedBy") REFERENCES "profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'AttendanceCorrectionStatus' AND e.enumlabel = 'manager_approved'
  ) THEN
    ALTER TYPE "AttendanceCorrectionStatus" ADD VALUE 'manager_approved';
  END IF;
END $$;
