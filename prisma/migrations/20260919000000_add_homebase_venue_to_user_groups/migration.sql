-- Add homebaseVenueId to user_groups for KPI homebase calculation
ALTER TABLE "user_groups" ADD COLUMN IF NOT EXISTS "homebaseVenueId" TEXT;

DO $$ BEGIN
  ALTER TABLE "user_groups"
    ADD CONSTRAINT "user_groups_homebaseVenueId_fkey"
    FOREIGN KEY ("homebaseVenueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "user_groups_homebaseVenueId_idx" ON "user_groups"("homebaseVenueId");
