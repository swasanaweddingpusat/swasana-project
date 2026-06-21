-- Migration: add_wedding_session_alt_to_leads
-- Adds weddingSessionAlt field to leads table for per-date session tracking.
-- Each date (eventDate and eventDateAlt) now has its own session.

-- Add weddingSessionAlt column (idempotent via IF NOT EXISTS)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "weddingSessionAlt" "WeddingSession";

-- Add composite index for alt-date availability check (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "leads_venueId_eventDateAlt_weddingSessionAlt_isDateLocked_idx"
  ON "leads" ("venueId", "eventDateAlt", "weddingSessionAlt", "isDateLocked");
