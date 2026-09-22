-- ─── Work Type (WFO / WFH / WFA) ──────────────────────────────────────────────
-- Adds:
--   - WorkType enum (WFO / WFH / WFA)
--   - attendances.workType (nullable — DAY_OFF records have no work type)

-- CreateEnum: WorkType (idempotent)
DO $$ BEGIN
  CREATE TYPE "WorkType" AS ENUM ('WFO', 'WFH', 'WFA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable attendances: add workType
ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "workType" "WorkType";
