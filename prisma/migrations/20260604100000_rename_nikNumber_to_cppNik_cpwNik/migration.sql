-- Migration: rename nikNumber → cppNik + cpwNik on customers and snap_customers
-- Idempotent: uses IF EXISTS / IF NOT EXISTS guards

-- ── customers table ──────────────────────────────────────────────────────────

-- Add new columns (idempotent)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cppNik" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cpwNik" TEXT;

-- Copy existing NIK data into cppNik (preserve before drop)
UPDATE "customers" SET "cppNik" = "nikNumber" WHERE "nikNumber" IS NOT NULL AND "cppNik" IS NULL;

-- Drop old column
ALTER TABLE "customers" DROP COLUMN IF EXISTS "nikNumber";

-- ── snap_customers table ─────────────────────────────────────────────────────

-- Add new columns (idempotent)
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "cppNik" TEXT;
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "cpwNik" TEXT;

-- Copy existing NIK data into cppNik (preserve before drop)
UPDATE "snap_customers" SET "cppNik" = "nikNumber" WHERE "nikNumber" IS NOT NULL AND "cppNik" IS NULL;

-- Drop old column
ALTER TABLE "snap_customers" DROP COLUMN IF EXISTS "nikNumber";
