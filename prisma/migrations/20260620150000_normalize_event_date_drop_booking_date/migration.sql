-- Migration: normalize_event_date_drop_booking_date
-- Phase C of bookingDate → eventDate normalization.
--
-- eventDate remains nullable at the DB level to allow MICE drafts to be
-- created before the event date is collected (multi-step form). NOT NULL is
-- enforced at the application layer (finalize guard in booking-mice-draft.ts
-- and booking-draft.ts).
--
-- Steps (idempotent):
--   1. Backfill: set eventDate = bookingDate for any rows where eventDate IS NULL
--   2. Drop the old bookingDate index IF EXISTS
--   3. Drop the bookingDate column IF EXISTS
--   4. Drop unique booking slot constraint that referenced booking_date (if present)
--      and recreate on event_date.

-- ── Step 1: Backfill eventDate from bookingDate (safety net) ─────────────────
-- All saved rows should already have eventDate populated. This guard makes
-- the migration idempotent and safe to re-run.
UPDATE "bookings"
SET "eventDate" = "bookingDate"
WHERE "eventDate" IS NULL
  AND "bookingDate" IS NOT NULL;

-- ── Step 2: Drop the bookingDate index ───────────────────────────────────────
DROP INDEX IF EXISTS "bookings_bookingDate_idx";

-- ── Step 3: Drop unique booking slot constraint that may reference bookingDate ─
-- The unique constraint was added in 20260606130000_add_unique_active_booking_slot.
-- It referenced booking_date. Drop it and recreate on event_date.
ALTER TABLE "bookings"
  DROP CONSTRAINT IF EXISTS "bookings_unique_active_slot";

-- Recreate the unique active slot constraint using eventDate
-- (CREATE UNIQUE INDEX IF NOT EXISTS is the idempotent way in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_unique_active_slot"
  ON "bookings" ("venueId", "eventDate", "weddingSession")
  WHERE "recordStatus" = 'saved'
    AND "bookingStatus" NOT IN ('Canceled', 'Lost', 'Rejected');

-- ── Step 4: Drop the bookingDate column ──────────────────────────────────────
ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "bookingDate";
