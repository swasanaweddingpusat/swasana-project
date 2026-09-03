-- Add religion, photo and KTP photo fields to candidates
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "religion" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "ktpPhotoUrl" TEXT;
