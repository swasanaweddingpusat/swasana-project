-- ─── Koreksi Absen (Attendance Correction) ───────────────────────────────────
-- Employee self-service request to fix a missed or wrong clock-in/out, with
-- required photo evidence, approved directly by HRD (single-step, no manager
-- stage). No FK back to `attendances` — correlation is via (profileId, date);
-- the corrected row is upserted on approval, not linked ahead of time.

-- CreateEnum: AttendanceCorrectionType (idempotent)
DO $$ BEGIN
  CREATE TYPE "AttendanceCorrectionType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: AttendanceCorrectionStatus (idempotent)
DO $$ BEGIN
  CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: attendance_corrections
CREATE TABLE IF NOT EXISTS "attendance_corrections" (
  "id"                  TEXT                          NOT NULL DEFAULT gen_random_uuid(),
  "profileId"           TEXT                          NOT NULL,
  "date"                TIMESTAMP(3)                  NOT NULL,

  "type"                "AttendanceCorrectionType"    NOT NULL,
  "requestedClockInAt"  TIMESTAMP(3),
  "requestedClockOutAt" TIMESTAMP(3),

  "workShiftId"         TEXT,
  "workLocationId"      TEXT,
  "workType"            "WorkType",

  "reason"              TEXT                          NOT NULL,
  "evidence"            JSONB,

  "status"              "AttendanceCorrectionStatus"  NOT NULL DEFAULT 'pending',
  "reviewedBy"          TEXT,
  "reviewedAt"          TIMESTAMP(3),
  "reviewNote"          TEXT,

  "cancelledAt"         TIMESTAMP(3),

  "createdAt"           TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)                 NOT NULL,

  CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_corrections_profileId_idx" ON "attendance_corrections"("profileId");
CREATE INDEX IF NOT EXISTS "attendance_corrections_date_idx" ON "attendance_corrections"("date");
CREATE INDEX IF NOT EXISTS "attendance_corrections_status_idx" ON "attendance_corrections"("status");

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
