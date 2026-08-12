-- Add visitor photo and ID photo fields to guestbook_entries
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "visitorPhotoUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "idPhotoUrl" TEXT;
