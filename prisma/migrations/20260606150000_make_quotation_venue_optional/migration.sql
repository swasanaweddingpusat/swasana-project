-- Make quotations.venueId optional (nullable) and switch FK to ON DELETE SET NULL.
-- Idempotent: safe to re-run.

-- 1. Drop existing FK constraint (Restrict) if present.
ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_venueId_fkey";

-- 2. Make the column nullable.
ALTER TABLE "quotations" ALTER COLUMN "venueId" DROP NOT NULL;

-- 3. Re-add FK with ON DELETE SET NULL (matches schema: venue Venue? ... onDelete: SetNull).
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
