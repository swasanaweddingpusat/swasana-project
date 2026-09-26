-- Repair drift left by a dead, never-consumed migration scaffold.
--
-- 20260923130000_add_attendance_correction (removed from this branch) created
-- "attendance_corrections" with a two-tier manager/HR approval shape
-- (managerApprovedBy/hrApprovedBy/rejectedBy, status "LeaveRequestStatus").
-- On any environment where that migration already ran (e.g. staging, from an
-- earlier deploy of main), the table exists under that wrong shape. The real
-- migration (20260922100000_create_attendance_correction, single-tier,
-- matching the current AttendanceCorrection model) sorts before it by folder
-- name, so it runs first and its `ADD CONSTRAINT ... FOREIGN KEY ("workShiftId")`
-- fails with undefined_column because that column never existed on the old
-- table. No application code ever wrote to the two-tier table (its UI/API were
-- orphaned and already deleted), so it is safe to drop and let the next
-- migration recreate it correctly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_corrections' AND column_name = 'managerApprovedBy'
  ) THEN
    DROP TABLE "attendance_corrections" CASCADE;
  END IF;
END $$;
