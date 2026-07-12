-- Drop dead fields: promoId + promoSnapshot from bookings, and
-- signature (record-level) from approval_records.
-- These fields have no readers or writers in the codebase.
-- ApprovalRecordStep.signature is NOT touched — that one is live.

-- 1. Drop FK constraint before dropping the column
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_promoId_fkey";

-- 2. Drop index on promoId
DROP INDEX IF EXISTS "bookings_promoId_idx";

-- 3. Drop the dead columns from bookings
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "promoId";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "promoSnapshot";

-- 4. Drop record-level signature from approval_records
--    (approval_record_steps.signature is a different column — not touched)
ALTER TABLE "approval_records" DROP COLUMN IF EXISTS "signature";
