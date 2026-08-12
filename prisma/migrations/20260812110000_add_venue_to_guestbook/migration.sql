-- Add venueId column to guestbook_entries
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "venueId" TEXT;

-- Create index for venueId
CREATE INDEX IF NOT EXISTS "guestbook_entries_venueId_idx" ON "guestbook_entries"("venueId");

-- Add foreign key constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guestbook_entries_venueId_fkey') THEN
    ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
