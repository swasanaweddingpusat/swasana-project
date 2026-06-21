-- Migration: add_lead_id_to_bookings
-- Adds leadId FK to bookings so draft bookings created from a Deal flow
-- can be identified and included in availability blocking (draft-from-lead blocks).

-- Add column (idempotent)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "leadId" TEXT;

-- Add FK constraint (drop first to make idempotent)
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_leadId_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index (idempotent)
CREATE INDEX IF NOT EXISTS "bookings_leadId_idx" ON "bookings"("leadId");
