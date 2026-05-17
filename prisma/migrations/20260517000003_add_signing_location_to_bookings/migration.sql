-- Add signingLocation to bookings table
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "signingLocation" TEXT;
