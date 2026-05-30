-- Migration: drop_afternoon_wedding_session
-- Removes 'afternoon' from the WeddingSession enum.
-- Business decision: only morning / evening / fullday are valid sessions.
--
-- Data migration: any existing booking with weddingSession = 'afternoon'
-- is remapped to 'evening' (closest equivalent for afternoon slots).
--
-- Postgres cannot DROP an enum value directly. The safe pattern is:
--   1. Migrate data off the old value
--   2. Create a new enum without the old value
--   3. ALTER COLUMN to use the new enum (with explicit CAST)
--   4. DROP the old enum
--   5. RENAME the new enum to the canonical name
--
-- This is wrapped in a transaction so it rolls back cleanly on any failure.

BEGIN;

-- Step 1: Remap afternoon bookings to evening
UPDATE "bookings"
  SET "weddingSession" = 'evening'
  WHERE "weddingSession" = 'afternoon';

-- Step 2: Create replacement enum without 'afternoon'
DO $$ BEGIN
  CREATE TYPE "WeddingSession_new" AS ENUM ('morning', 'evening', 'fullday');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 3: Alter the column to use the new enum type
--   We use USING with an explicit cast via text so Postgres knows how to coerce
--   the existing values ('morning', 'evening', 'fullday') into the new enum.
ALTER TABLE "bookings"
  ALTER COLUMN "weddingSession"
  TYPE "WeddingSession_new"
  USING "weddingSession"::text::"WeddingSession_new";

-- Step 4: Drop the old enum
DROP TYPE IF EXISTS "WeddingSession";

-- Step 5: Rename new enum to canonical name
ALTER TYPE "WeddingSession_new" RENAME TO "WeddingSession";

COMMIT;
