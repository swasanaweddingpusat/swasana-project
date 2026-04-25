-- Add bitrixId to customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "bitrixId" TEXT;

-- Update BookingComment index: drop old, add composite
DROP INDEX IF EXISTS "booking_comments_bookingId_idx";
CREATE INDEX IF NOT EXISTS "booking_comments_bookingId_createdAt_idx" ON "booking_comments"("bookingId", "createdAt");
