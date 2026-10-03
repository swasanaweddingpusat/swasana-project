-- Barcode/ID-card reuse: one row per scan so a single guestbook entry
-- can be checked in across many festivals & days without editing dates.

CREATE TABLE IF NOT EXISTS "guestbook_visits" (
  "id"               TEXT NOT NULL,
  "entryId"          TEXT NOT NULL,
  "festivalId"       TEXT,
  "visitedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedById"    TEXT,
  "actualGuestCount" INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guestbook_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guestbook_visits_entryId_idx" ON "guestbook_visits"("entryId");
CREATE INDEX IF NOT EXISTS "guestbook_visits_festivalId_idx" ON "guestbook_visits"("festivalId");
CREATE INDEX IF NOT EXISTS "guestbook_visits_visitedAt_idx" ON "guestbook_visits"("visitedAt");

ALTER TABLE "guestbook_visits" DROP CONSTRAINT IF EXISTS "guestbook_visits_entryId_fkey";
ALTER TABLE "guestbook_visits" ADD CONSTRAINT "guestbook_visits_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "guestbook_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guestbook_visits" DROP CONSTRAINT IF EXISTS "guestbook_visits_festivalId_fkey";
ALTER TABLE "guestbook_visits" ADD CONSTRAINT "guestbook_visits_festivalId_fkey"
  FOREIGN KEY ("festivalId") REFERENCES "festivals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guestbook_visits" DROP CONSTRAINT IF EXISTS "guestbook_visits_confirmedById_fkey";
ALTER TABLE "guestbook_visits" ADD CONSTRAINT "guestbook_visits_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: preserve existing single-scan attendance as the first visit row.
-- Guarded by NOT EXISTS so re-running the migration never double-inserts.
INSERT INTO "guestbook_visits" ("id", "entryId", "festivalId", "visitedAt", "confirmedById", "actualGuestCount", "createdAt")
SELECT
  gen_random_uuid()::text,
  e."id",
  e."festivalId",
  e."attendanceConfirmedAt",
  e."attendanceConfirmedById",
  e."actualGuestCount",
  e."attendanceConfirmedAt"
FROM "guestbook_entries" e
WHERE e."attendanceConfirmedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "guestbook_visits" v WHERE v."entryId" = e."id"
  );
