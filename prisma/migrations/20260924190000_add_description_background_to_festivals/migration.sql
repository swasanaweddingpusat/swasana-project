-- Festival CMS fields: replaceable description + uploaded background image
-- (used by the guestbook ticket/QR renderer to theme the ticket per festival)
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "backgroundImageKey" TEXT;
