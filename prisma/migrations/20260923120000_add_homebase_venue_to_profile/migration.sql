ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "homebaseVenueId" TEXT;

CREATE INDEX IF NOT EXISTS "profiles_homebaseVenueId_idx" ON "profiles"("homebaseVenueId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_homebaseVenueId_fkey'
  ) THEN
    ALTER TABLE "profiles"
      ADD CONSTRAINT "profiles_homebaseVenueId_fkey"
      FOREIGN KEY ("homebaseVenueId") REFERENCES "venues"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
