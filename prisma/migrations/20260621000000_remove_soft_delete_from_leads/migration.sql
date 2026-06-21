-- Migration: remove_soft_delete_from_leads
-- Removes the deletedAt soft-delete field from the leads table,
-- converting to hard-delete behaviour (db.lead.delete instead of marking deletedAt).
-- Rebuilds partial unique indexes that referenced deletedAt to work without it.
-- All statements are idempotent.

-- ── 1. Drop indexes that reference deletedAt (must drop before column) ─────────

DROP INDEX IF EXISTS "leads_deletedAt_idx";
DROP INDEX IF EXISTS "leads_unique_active_lock_primary";
DROP INDEX IF EXISTS "leads_unique_active_lock_secondary";

-- ── 2. Drop the deletedAt column ─────────────────────────────────────────────

ALTER TABLE "leads"
  DROP COLUMN IF EXISTS "deletedAt";

-- ── 3. Rebuild partial unique indexes without deletedAt condition ─────────────
-- Deleted leads no longer exist as rows (hard delete), so no need to exclude them.
-- The convertedAt IS NULL guard is sufficient: converted leads no longer block slots.

-- Primary venue: only one active locked lead per venue+date+session
CREATE UNIQUE INDEX IF NOT EXISTS "leads_unique_active_lock_primary"
  ON "leads"("venueId", "eventDate", "weddingSession")
  WHERE "isDateLocked" = TRUE
    AND "convertedAt" IS NULL
    AND "venueId" IS NOT NULL
    AND "eventDate" IS NOT NULL
    AND "weddingSession" IS NOT NULL;

-- Secondary venue: same constraint for the secondary/backup venue slot
CREATE UNIQUE INDEX IF NOT EXISTS "leads_unique_active_lock_secondary"
  ON "leads"("venueSecondaryId", "eventDate", "weddingSession")
  WHERE "isDateLocked" = TRUE
    AND "convertedAt" IS NULL
    AND "venueSecondaryId" IS NOT NULL
    AND "eventDate" IS NOT NULL
    AND "weddingSession" IS NOT NULL;
