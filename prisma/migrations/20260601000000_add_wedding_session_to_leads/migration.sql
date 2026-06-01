-- Add weddingSession field to leads table
-- WeddingSession enum (morning | evening | fullday) already exists in DB from bookings module
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "weddingSession" "WeddingSession";
