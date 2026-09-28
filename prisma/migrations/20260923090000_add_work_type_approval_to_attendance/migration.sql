-- WFH/WFA butuh approval HR. WFO tetap auto-trusted (divalidasi GPS radius saat
-- clock-in), jadi field ini null untuk WFO & Day Off — hanya diisi "pending" saat
-- clock-in dengan workType IN (WFH, WFA). Reject cuma menandai status di sini,
-- TIDAK menyentuh Attendance.status (karyawan tetap dapat kredit hadir).

-- CreateEnum: WorkTypeApprovalStatus (idempotent)
DO $$ BEGIN
  CREATE TYPE "WorkTypeApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeReason" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeApprovalStatus" "WorkTypeApprovalStatus";
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeApprovedBy" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeApprovedAt" TIMESTAMP(3);
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workTypeReviewNote" TEXT;

CREATE INDEX IF NOT EXISTS "attendances_workTypeApprovalStatus_idx" ON "attendances"("workTypeApprovalStatus");

DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_workTypeApprovedBy_fkey"
    FOREIGN KEY ("workTypeApprovedBy") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
