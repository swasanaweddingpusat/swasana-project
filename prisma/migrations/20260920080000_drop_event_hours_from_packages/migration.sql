-- Drop the MICE "Jam" (event hours) field from packages. The field was added
-- in 20260920060000 but is no longer needed — event type (eventTypeId) remains.

ALTER TABLE "packages" DROP COLUMN IF EXISTS "eventHours";
