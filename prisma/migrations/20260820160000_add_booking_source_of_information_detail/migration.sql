-- Optional freetext detail alongside sourceOfInformationId on bookings
-- (e.g. referrer name when source is "Referal").
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "sourceOfInformationDetail" TEXT;
