-- Migration: add_availability_fields_to_leads
-- Adds 8 new fields to the leads table for date availability & booking fee tracking,
-- a secondary venue relation, and indexes for efficient availability queries.
-- All statements are idempotent (IF NOT EXISTS / DO NOTHING).

-- ── 1. New columns ───────────────────────────────────────────────────────────

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "emailCpp"              TEXT,
  ADD COLUMN IF NOT EXISTS "emailCpw"              TEXT,
  ADD COLUMN IF NOT EXISTS "eventDateAlt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "venueSecondaryId"      TEXT,
  ADD COLUMN IF NOT EXISTS "isDateLocked"          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "bookingFeeAmount"      INTEGER,
  ADD COLUMN IF NOT EXISTS "bookingFeeDate"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bookingFeeEvidenceUrl" TEXT;

-- ── 2. Foreign key: venueSecondaryId → venues(id) ───────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_venueSecondaryId_fkey'
  ) THEN
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_venueSecondaryId_fkey"
      FOREIGN KEY ("venueSecondaryId")
      REFERENCES "venues"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END;
$$;

-- ── 3. Regular indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "leads_venueSecondaryId_idx"
  ON "leads"("venueSecondaryId");

CREATE INDEX IF NOT EXISTS "leads_isDateLocked_idx"
  ON "leads"("isDateLocked");

-- Composite index for availability check query:
-- WHERE venueId = $1 AND isDateLocked = true AND eventDate BETWEEN $2 AND $3
CREATE INDEX IF NOT EXISTS "leads_venueId_eventDate_weddingSession_isDateLocked_idx"
  ON "leads"("venueId", "eventDate", "weddingSession", "isDateLocked");

-- Secondary venue availability check:
-- WHERE venueSecondaryId = $1 AND isDateLocked = true AND eventDate BETWEEN $2 AND $3
CREATE INDEX IF NOT EXISTS "leads_venueSecondaryId_eventDate_isDateLocked_idx"
  ON "leads"("venueSecondaryId", "eventDate", "isDateLocked");

-- ── 4. Partial unique index (anti double-lock) ───────────────────────────────
-- Prevent two active locked leads from claiming the same venue+date+session combo.
-- "Active" = isDateLocked IS TRUE AND convertedAt IS NULL (not yet converted/lost).
-- NULL sessions are excluded — they'd always conflict with each other otherwise.
-- This uses a partial index so it only enforces the constraint among active locked leads.

CREATE UNIQUE INDEX IF NOT EXISTS "leads_unique_active_lock_primary"
  ON "leads"("venueId", "eventDate", "weddingSession")
  WHERE "isDateLocked" = TRUE
    AND "convertedAt" IS NULL
    AND "venueId" IS NOT NULL
    AND "eventDate" IS NOT NULL
    AND "weddingSession" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_unique_active_lock_secondary"
  ON "leads"("venueSecondaryId", "eventDate", "weddingSession")
  WHERE "isDateLocked" = TRUE
    AND "convertedAt" IS NULL
    AND "venueSecondaryId" IS NOT NULL
    AND "eventDate" IS NOT NULL
    AND "weddingSession" IS NOT NULL;
