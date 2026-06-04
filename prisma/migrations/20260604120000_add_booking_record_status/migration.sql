-- Create BookingRecordStatus enum
DO $$ BEGIN
  CREATE TYPE "BookingRecordStatus" AS ENUM ('draft', 'saved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add recordStatus column to bookings table (default 'saved' — existing rows stay as-is)
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "recordStatus" "BookingRecordStatus" NOT NULL DEFAULT 'saved';

-- Add index on recordStatus for efficient draft filtering
CREATE INDEX IF NOT EXISTS "bookings_recordStatus_idx" ON "bookings"("recordStatus");
