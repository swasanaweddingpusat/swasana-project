-- Store the selected "Hari Besar" (public holiday) on the attendance snapshot.
-- publicHolidayId links to the master; publicHolidayName is a snapshot so the row
-- survives a rename/delete of the master entry.

ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "publicHolidayId" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "publicHolidayName" TEXT;

CREATE INDEX IF NOT EXISTS "attendances_publicHolidayId_idx" ON "attendances"("publicHolidayId");

DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_publicHolidayId_fkey"
    FOREIGN KEY ("publicHolidayId") REFERENCES "public_holidays"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
