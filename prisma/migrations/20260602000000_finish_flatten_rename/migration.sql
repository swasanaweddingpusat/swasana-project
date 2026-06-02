-- ============================================================================
-- finish_flatten_rename
-- ----------------------------------------------------------------------------
-- Menuntaskan bagian migration 20260530053946 yang GAGAL di PRODUCTION:
-- rename kolom packages dari snake_case -> camelCase.
--
-- Di PROD, 20260530053946 sempat partial-applied: kolom packages masih
-- `selling_price` / `term_and_condition` (snake), padahal Prisma Client
-- (seeder & app) mengharapkan `sellingPrice` / `termAndCondition` (camel).
-- Tanpa rename ini, semua query packages akan crash.
--
-- IDEMPOTENT: aman dijalankan berulang & di DB yang sudah camelCase
-- (mis. STAGING / DEV) — semua langkah pakai IF [NOT] EXISTS.
-- packages PROD = 0 baris setelah cleanup, jadi UPDATE backfill no-op,
-- tapi tetap ditulis full agar aman jika ada data.
-- ============================================================================

-- 1. Tambah kolom camelCase jika belum ada
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "sellingPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "termAndCondition" TEXT;

-- 2. Backfill dari kolom snake_case lama (hanya jika kolom lama masih ada)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'selling_price'
  ) THEN
    EXECUTE 'UPDATE "packages" SET "sellingPrice" = "selling_price" WHERE "sellingPrice" = 0';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'term_and_condition'
  ) THEN
    EXECUTE 'UPDATE "packages" SET "termAndCondition" = "term_and_condition" WHERE "termAndCondition" IS NULL';
  END IF;
END $$;

-- 3. Drop kolom snake_case lama jika masih ada
ALTER TABLE "packages" DROP COLUMN IF EXISTS "selling_price";
ALTER TABLE "packages" DROP COLUMN IF EXISTS "term_and_condition";
