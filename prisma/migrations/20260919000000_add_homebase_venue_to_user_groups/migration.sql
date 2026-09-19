-- Add homebaseVenueId to user_groups for KPI homebase calculation
ALTER TABLE "user_groups" ADD COLUMN IF NOT EXISTS "homebaseVenueId" TEXT;

ALTER TABLE "user_groups"
  ADD CONSTRAINT IF NOT EXISTS "user_groups_homebaseVenueId_fkey"
  FOREIGN KEY ("homebaseVenueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "user_groups_homebaseVenueId_idx" ON "user_groups"("homebaseVenueId");
