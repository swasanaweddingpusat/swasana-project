-- Persist the event metadata currently collected by the Booking MICE form and
-- freeze display values needed after master-data changes.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "eventEndDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eventTypeId" TEXT,
  ADD COLUMN IF NOT EXISTS "eventTypeName" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedPax" INTEGER,
  ADD COLUMN IF NOT EXISTS "companyName" TEXT;

CREATE INDEX IF NOT EXISTS "bookings_eventTypeId_idx" ON "bookings"("eventTypeId");

ALTER TABLE "bookings"
  DROP CONSTRAINT IF EXISTS "bookings_eventTypeId_fkey";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_eventTypeId_fkey"
  FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
