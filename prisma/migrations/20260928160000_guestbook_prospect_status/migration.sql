-- Ganti enum GuestVisitStatus + GuestInteractionType dengan tabel ProspectStatus
-- yang bisa dikelola lewat Settings.

-- 1. Tabel master status prospek.
CREATE TABLE "prospect_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prospect_statuses_name_key" ON "prospect_statuses"("name");

-- 2. Isi status awal. sortOrder mengikuti alur prospek dari dingin ke closing.
INSERT INTO "prospect_statuses" ("id", "name", "sortOrder", "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), 'Cold Prospek',             10, NOW(), NOW()),
    (gen_random_uuid(), 'Warm',                     20, NOW(), NOW()),
    (gen_random_uuid(), 'Hot',                      30, NOW(), NOW()),
    (gen_random_uuid(), 'No Response',              40, NOW(), NOW()),
    (gen_random_uuid(), 'Online Meeting',           50, NOW(), NOW()),
    (gen_random_uuid(), 'Belum Visit',              60, NOW(), NOW()),
    (gen_random_uuid(), 'Visit Venue',              70, NOW(), NOW()),
    (gen_random_uuid(), 'Tidak Jadi Visit (Lost)',  80, NOW(), NOW()),
    (gen_random_uuid(), 'Deal',                     90, NOW(), NOW()),
    (gen_random_uuid(), 'No Deal (Lost)',          100, NOW(), NOW()),
    (gen_random_uuid(), 'Survey',                  110, NOW(), NOW());

-- 3. Kolom relasi baru.
ALTER TABLE "guestbook_entries" ADD COLUMN "prospectStatusId" TEXT;

-- 4. Pindahkan data lama. interactionType = 'online_meeting' diprioritaskan
--    menjadi 'Cold Prospek' (keputusan bisnis), sisanya dipetakan dari
--    visitStatus: to_be_discuss -> Warm, done_visit -> Visit Venue,
--    lost -> Tidak Jadi Visit (Lost).
UPDATE "guestbook_entries" e
SET "prospectStatusId" = s."id"
FROM "prospect_statuses" s
WHERE s."name" = CASE
    WHEN e."interactionType" = 'online_meeting' THEN 'Cold Prospek'
    WHEN e."visitStatus" = 'cold'               THEN 'Cold Prospek'
    WHEN e."visitStatus" = 'warm'               THEN 'Warm'
    WHEN e."visitStatus" = 'to_be_discuss'      THEN 'Warm'
    WHEN e."visitStatus" = 'hot'                THEN 'Hot'
    WHEN e."visitStatus" = 'done_visit'         THEN 'Visit Venue'
    WHEN e."visitStatus" = 'deal'               THEN 'Deal'
    WHEN e."visitStatus" = 'lost'               THEN 'Tidak Jadi Visit (Lost)'
    ELSE NULL
  END;

-- 5. Lepas kolom & enum lama.
DROP INDEX IF EXISTS "guestbook_entries_interactionType_idx";

ALTER TABLE "guestbook_entries" DROP COLUMN "interactionType";
ALTER TABLE "guestbook_entries" DROP COLUMN "visitStatus";

DROP TYPE "GuestInteractionType";
DROP TYPE "GuestVisitStatus";

-- 6. Index + foreign key untuk kolom baru.
CREATE INDEX "guestbook_entries_prospectStatusId_idx" ON "guestbook_entries"("prospectStatusId");

ALTER TABLE "guestbook_entries"
    ADD CONSTRAINT "guestbook_entries_prospectStatusId_fkey"
    FOREIGN KEY ("prospectStatusId") REFERENCES "prospect_statuses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
