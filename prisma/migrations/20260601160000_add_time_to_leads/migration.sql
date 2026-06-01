-- Add event time (free-text range, e.g. "08:00 - 14:00") to leads, mirroring quotation.
-- Idempotent.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "time" TEXT;
