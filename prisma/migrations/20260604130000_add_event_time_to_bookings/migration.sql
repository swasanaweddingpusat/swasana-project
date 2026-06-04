-- Add eventTime field to bookings table for MICE event time tracking
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "eventTime" TEXT;
