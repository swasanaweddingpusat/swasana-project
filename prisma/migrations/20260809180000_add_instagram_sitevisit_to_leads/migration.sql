-- MICE prospecting fields moved from Google Sheet "Daily Activity MICE".
-- Physical table for model DailyActivity is "leads" (see @@map).
-- instagramUrl: stored as-is (username OR full URL). siteVisitDate: venue visit schedule.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "siteVisitDate" TIMESTAMP(3);
