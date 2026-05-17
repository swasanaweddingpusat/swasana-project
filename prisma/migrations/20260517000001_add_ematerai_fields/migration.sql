-- Add withMaterai to bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "withMaterai" BOOLEAN NOT NULL DEFAULT false;

-- Remove deprecated signatures column from bookings
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "signatures";

-- Add ematerai fields to approval_records
ALTER TABLE "approval_records" ADD COLUMN IF NOT EXISTS "emateraiSn" TEXT;
ALTER TABLE "approval_records" ADD COLUMN IF NOT EXISTS "emateraiQrBase64" TEXT;
