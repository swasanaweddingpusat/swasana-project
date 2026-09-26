-- Holiday token: from auto-derived (every active PublicHoliday) to an explicit
-- HRD-granted ledger. A grant = one profile + one PublicHoliday, issued by HRD.
-- publicHolidayName is a snapshot (same pattern as leave_requests.publicHolidayName)
-- so the grant keeps showing the holiday's name even if the master row is renamed.

CREATE TABLE IF NOT EXISTS "holiday_token_grants" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "publicHolidayId" TEXT NOT NULL,
  "publicHolidayName" TEXT NOT NULL,
  "note" TEXT,
  "grantedBy" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "holiday_token_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "holiday_token_grants_profileId_publicHolidayId_key"
  ON "holiday_token_grants"("profileId", "publicHolidayId");
CREATE INDEX IF NOT EXISTS "holiday_token_grants_profileId_idx" ON "holiday_token_grants"("profileId");
CREATE INDEX IF NOT EXISTS "holiday_token_grants_publicHolidayId_idx" ON "holiday_token_grants"("publicHolidayId");

DO $$ BEGIN
  ALTER TABLE "holiday_token_grants" ADD CONSTRAINT "holiday_token_grants_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "holiday_token_grants" ADD CONSTRAINT "holiday_token_grants_publicHolidayId_fkey" FOREIGN KEY ("publicHolidayId") REFERENCES "public_holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "holiday_token_grants" ADD CONSTRAINT "holiday_token_grants_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
