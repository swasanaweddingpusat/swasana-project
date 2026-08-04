-- Add place field to quotations table
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "place" TEXT;
