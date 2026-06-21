-- Migration: add_year_to_user_targets
-- Adds a per-year dimension to UserTarget so each (profileId, type, year) is unique.
-- Steps:
--   1. Add nullable column year
--   2. Backfill from createdAt
--   3. Deduplicate rows (keep latest updatedAt per group) before adding unique constraint
--   4. Set NOT NULL
--   5. Create unique index

-- Step 1: Add column (nullable first so backfill can run)
ALTER TABLE "user_targets" ADD COLUMN IF NOT EXISTS "year" INTEGER;

-- Step 2: Backfill — derive year from createdAt for existing rows
UPDATE "user_targets"
SET "year" = EXTRACT(YEAR FROM "createdAt")::INTEGER
WHERE "year" IS NULL;

-- Step 3: Deduplicate — keep the row with the latest updatedAt per (profileId, type, year)
-- Uses ctid (physical row identifier) to delete all but the winner safely.
DELETE FROM "user_targets"
WHERE ctid NOT IN (
  SELECT DISTINCT ON ("profileId", "type", "year") ctid
  FROM "user_targets"
  ORDER BY "profileId", "type", "year", "updatedAt" DESC
);

-- Step 4: Set NOT NULL (all rows now have a year value)
ALTER TABLE "user_targets" ALTER COLUMN "year" SET NOT NULL;

-- Step 5: Create unique index (IF NOT EXISTS — idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "user_targets_profileId_type_year_key"
  ON "user_targets" ("profileId", "type", "year");
