-- Add promo (discount program) reference + snapshot to bookings.
-- promoId: nullable FK to discount_programs, ON DELETE SET NULL so removing a
-- program never breaks a booking. promoSnapshot: full program data captured at
-- booking time (historical accuracy, independent of later program edits).

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "promoId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "promoSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "bookings_promoId_idx" ON "bookings" ("promoId");

ALTER TABLE "bookings"
  DROP CONSTRAINT IF EXISTS "bookings_promoId_fkey";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_promoId_fkey"
  FOREIGN KEY ("promoId") REFERENCES "discount_programs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
