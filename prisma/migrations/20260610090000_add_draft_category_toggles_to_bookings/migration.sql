-- AddColumn draftCategoryToggles and draftComplimentaries to bookings
-- Migration is idempotent: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "draftCategoryToggles" JSONB;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "draftComplimentaries" JSONB;
