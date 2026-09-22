-- Drop old single-venue homebase column and its constraints
ALTER TABLE "user_groups" DROP CONSTRAINT IF EXISTS "user_groups_homebaseVenueId_fkey";
DROP INDEX IF EXISTS "user_groups_homebaseVenueId_idx";
ALTER TABLE "user_groups" DROP COLUMN IF EXISTS "homebaseVenueId";

-- Create many-to-many join table for group homebases
CREATE TABLE IF NOT EXISTS "user_group_homebases" (
  "groupId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  CONSTRAINT "user_group_homebases_pkey" PRIMARY KEY ("groupId", "venueId"),
  CONSTRAINT "user_group_homebases_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_group_homebases_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
