-- Migration: add_soft_delete_to_leads
-- Adds a deletedAt field for soft delete on the leads table.
-- Also rebuilds the partial unique indexes (anti double-lock) to exclude
-- soft-deleted rows so they no longer hold venue+date+session slots.
-- All statements are idempotent.

-- ── 1. Add deletedAt column ───────────────────────────────────────────────────

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ── 2. Index on deletedAt for efficient soft-delete filtering ─────────────────

CREATE INDEX IF NOT EXISTS "leads_deletedAt_idx"
  ON "leads"("deletedAt");

-- ── 3. Rebuild partial unique indexes to exclude soft-deleted rows ────────────
-- Drop the old indexes first (IF EXISTS so idempotent on re-apply),
-- then recreate them with the additional "deletedAt IS NULL" condition.

DROP INDEX IF EXISTS "leads_unique_active_lock_primary";
DROP INDEX IF EXISTS "leads_unique_active_lock_secondary";

-- Primary venue: only one active locked lead per venue+date+session
CREATE UNIQUE INDEX IF NOT EXISTS "leads_unique_active_lock_primary"
  ON "leads"("venueId", "eventDate", "weddingSession")
  WHERE "isDateLocked" = TRUE
    AND "convertedAt" IS NULL
    AND "deletedAt" IS NULL
    AND "venueId" IS NOT NULL
    AND "eventDate" IS NOT NULL
    AND "weddingSession" IS NOT NULL;

-- Secondary venue: same constraint for the secondary/backup venue slot
CREATE UNIQUE INDEX IF NOT EXISTS "leads_unique_active_lock_secondary"
  ON "leads"("venueSecondaryId", "eventDate", "weddingSession")
  WHERE "isDateLocked" = TRUE
    AND "convertedAt" IS NULL
    AND "deletedAt" IS NULL
    AND "venueSecondaryId" IS NOT NULL
    AND "eventDate" IS NOT NULL
    AND "weddingSession" IS NOT NULL;
