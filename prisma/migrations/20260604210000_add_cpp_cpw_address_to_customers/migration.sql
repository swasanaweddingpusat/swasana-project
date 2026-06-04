-- Add cppAddress and cpwAddress columns to customers table (non-destructive: ktpAddress kept)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cppAddress" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cpwAddress" TEXT;

-- Add cppAddress and cpwAddress columns to snap_customers table (non-destructive: ktpAddress kept)
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "cppAddress" TEXT;
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "cpwAddress" TEXT;

-- Copy existing ktpAddress data → cppAddress for backward compatibility
-- Booking lama tetap punya alamat di PDF (jatuh ke CPP)
UPDATE "customers"
SET "cppAddress" = "ktpAddress"
WHERE "cppAddress" IS NULL AND "ktpAddress" IS NOT NULL;

UPDATE "snap_customers"
SET "cppAddress" = "ktpAddress"
WHERE "cppAddress" IS NULL AND "ktpAddress" IS NOT NULL;
