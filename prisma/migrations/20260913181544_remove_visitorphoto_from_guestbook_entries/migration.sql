-- Remove guest-photo column from guestbook (app-layer usage already removed; proof files retained)
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "visitorPhoto";
