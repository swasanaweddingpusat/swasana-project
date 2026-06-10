-- Migration: split_customer_email_cpp_cpw
-- Adds emailCpp and emailCpw columns to customers and snap_customers,
-- migrates existing email data to emailCpp, then drops the old email column.

-- ─── customers ────────────────────────────────────────────────────────────────

-- 1. Add new nullable columns (idempotent)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email_cpp" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email_cpw" TEXT;

-- 2. Migrate existing email data → email_cpp (preserve data, Opsi A)
UPDATE "customers"
SET "email_cpp" = "email"
WHERE "email_cpp" IS NULL
  AND "email" IS NOT NULL
  AND "email" != ''
  AND "email" != '-@placeholder.com';

-- 3. Drop old email column
ALTER TABLE "customers" DROP COLUMN IF EXISTS "email";

-- ─── snap_customers ───────────────────────────────────────────────────────────

-- 1. Add new nullable columns (idempotent)
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "email_cpp" TEXT;
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "email_cpw" TEXT;

-- 2. Migrate existing email data → email_cpp (preserve data)
UPDATE "snap_customers"
SET "email_cpp" = "email"
WHERE "email_cpp" IS NULL
  AND "email" IS NOT NULL
  AND "email" != ''
  AND "email" != '-@placeholder.com';

-- 3. Drop old email column
ALTER TABLE "snap_customers" DROP COLUMN IF EXISTS "email";
