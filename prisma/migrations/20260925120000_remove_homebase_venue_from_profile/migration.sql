ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_homebaseVenueId_fkey";

DROP INDEX IF EXISTS "profiles_homebaseVenueId_idx";

ALTER TABLE "profiles" DROP COLUMN IF EXISTS "homebaseVenueId";
