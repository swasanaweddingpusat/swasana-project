-- Make packageId nullable (MICE bookings have no package)
ALTER TABLE "bookings" ALTER COLUMN "packageId" DROP NOT NULL;

-- MICE-specific columns
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "eventDate" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "quotationId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "salesSignature" TEXT;

-- Index for MICE event-date filtering
CREATE INDEX IF NOT EXISTS "bookings_eventDate_idx" ON "bookings"("eventDate");
