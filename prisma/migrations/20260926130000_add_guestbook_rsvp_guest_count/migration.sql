-- Public RSVP link (guest confirms how many guests will attend) + guest count fields on GuestbookEntry
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "rsvpToken" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "confirmedGuestCount" INTEGER;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "confirmedGuestCountAt" TIMESTAMP(3);
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "actualGuestCount" INTEGER;

-- Backfill a token for existing rows so old tickets can also get a working RSVP link
-- (gen_random_uuid() is built into PostgreSQL 13+, no extension required)
UPDATE "guestbook_entries"
SET "rsvpToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "rsvpToken" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "guestbook_entries_rsvpToken_key" ON "guestbook_entries"("rsvpToken");
