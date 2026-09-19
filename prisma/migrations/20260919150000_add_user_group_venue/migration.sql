-- Many-to-many: satu Group (sales team, "user_groups") bisa di-assign ke banyak
-- Venue sekaligus. Informational/filter only — TIDAK dipakai oleh access-control
-- / dataScope. Composite PK + cascade delete kedua sisi, pola sama seperti
-- "user_group_members" (lihat 20260420040054_add_user_groups).

CREATE TABLE IF NOT EXISTS "user_group_venues" (
  "groupId"   TEXT NOT NULL,
  "venueId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_group_venues_pkey" PRIMARY KEY ("groupId", "venueId")
);

CREATE INDEX IF NOT EXISTS "user_group_venues_venueId_idx" ON "user_group_venues"("venueId");

DO $$ BEGIN
  ALTER TABLE "user_group_venues"
    ADD CONSTRAINT "user_group_venues_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "user_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_group_venues"
    ADD CONSTRAINT "user_group_venues_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "venues"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
