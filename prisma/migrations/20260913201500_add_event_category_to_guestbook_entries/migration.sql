-- Add eventCategory (Wedding/MICE) to guestbook_entries. Direct choice, independent of the
-- linked package — the list "Event" column reads this, falling back to package.category.
-- Idempotent. Reuses the existing "EventCategory" enum type (WEDDINGS | MICE).
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "eventCategory" "EventCategory";
