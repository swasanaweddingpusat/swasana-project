-- Add cancelReason column to bookings (status Canceled reason)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
