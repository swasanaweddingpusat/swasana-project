-- Migration: rename_email_cpp_cpw_to_camelcase
-- Renames email_cpp/email_cpw (snake_case) to emailCpp/emailCpw (camelCase)
-- to match Prisma schema field names (no @map annotation).
-- The previous migration (20260609134449_split_customer_email_cpp_cpw) created
-- them as snake_case, but Prisma expects camelCase without @map.

-- ─── customers ────────────────────────────────────────────────────────────────

-- Rename email_cpp → emailCpp (idempotent: only if email_cpp exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'email_cpp'
  ) THEN
    ALTER TABLE "customers" RENAME COLUMN "email_cpp" TO "emailCpp";
  END IF;
END $$;

-- Rename email_cpw → emailCpw (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'email_cpw'
  ) THEN
    ALTER TABLE "customers" RENAME COLUMN "email_cpw" TO "emailCpw";
  END IF;
END $$;

-- ─── snap_customers ───────────────────────────────────────────────────────────

-- Rename email_cpp → emailCpp (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'snap_customers'
      AND column_name = 'email_cpp'
  ) THEN
    ALTER TABLE "snap_customers" RENAME COLUMN "email_cpp" TO "emailCpp";
  END IF;
END $$;

-- Rename email_cpw → emailCpw (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'snap_customers'
      AND column_name = 'email_cpw'
  ) THEN
    ALTER TABLE "snap_customers" RENAME COLUMN "email_cpw" TO "emailCpw";
  END IF;
END $$;
