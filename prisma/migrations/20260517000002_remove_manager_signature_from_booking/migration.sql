-- Remove legacy manager approval fields from bookings table
-- These fields are replaced by the ApprovalRecord / ApprovalRecordStep system.

ALTER TABLE "bookings" DROP COLUMN IF EXISTS "managerApprovedAt";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "managerSignature";
