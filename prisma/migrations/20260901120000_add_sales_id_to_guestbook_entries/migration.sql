-- Add salesId column to guestbook_entries (ownership for scope + metrics, mirrors Booking.salesId)
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "salesId" TEXT;

-- Create index for salesId
CREATE INDEX IF NOT EXISTS "guestbook_entries_salesId_idx" ON "guestbook_entries"("salesId");

-- Add foreign key constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guestbook_entries_salesId_fkey') THEN
    ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: attribute existing entries to their recorder (createdById) so they
-- don't disappear from "own" scope for the sales who logged them.
UPDATE "guestbook_entries" SET "salesId" = "createdById" WHERE "salesId" IS NULL AND "createdById" IS NOT NULL;
