-- Add optional sourceOfInformationDetail (free-text note about the source, e.g.
-- referrer name) to daily_activities, mirroring Booking's sourceOfInformationDetail.
ALTER TABLE "daily_activities" ADD COLUMN IF NOT EXISTS "sourceOfInformationDetail" TEXT;
