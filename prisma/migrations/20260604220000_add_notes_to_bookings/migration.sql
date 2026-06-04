-- Add notes field to bookings table for storing noteDateEvent (event notes from booking step 1)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "notes" TEXT;
