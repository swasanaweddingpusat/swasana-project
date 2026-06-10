-- Add currentRevisionId to bookings (idempotent)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "currentRevisionId" TEXT;

-- Add FK constraint (idempotent: drop if exists first, then add)
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_currentRevisionId_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_currentRevisionId_fkey"
  FOREIGN KEY ("currentRevisionId") REFERENCES "booking_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index (idempotent)
CREATE INDEX IF NOT EXISTS "bookings_currentRevisionId_idx" ON "bookings"("currentRevisionId");
