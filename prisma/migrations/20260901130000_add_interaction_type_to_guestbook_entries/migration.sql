-- Fase 2: promote interactionType to the primary axis for guestbook entries.
-- purpose column is KEPT (non-destructive) but demoted from the sales form UI.

DO $$ BEGIN
  CREATE TYPE "GuestInteractionType" AS ENUM ('client_visit', 'online_meeting', 'jemput_bola');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OnlineMeetingMedium" AS ENUM ('zoom', 'google_meet', 'whatsapp_call', 'microsoft_teams', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "interactionType" "GuestInteractionType";
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "onlineMedium" "OnlineMeetingMedium";
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "meetingUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "meetingLocation" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "guestbook_entries_interactionType_idx" ON "guestbook_entries"("interactionType");
