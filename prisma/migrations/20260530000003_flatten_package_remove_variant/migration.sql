-- ═══════════════════════════════════════════════════════════════════════
-- Flatten Package — Remove PackageVariant concept (2026-05-30)
--
-- Design change: 1 Package = 1 pax tier (no variants).
-- All fields previously on PackageVariant move to Package directly.
-- SnapPackagePricing retained as immutable booking history (renamed from SnapPackageVariant).
-- BookingRevision columns renamed: variantPrice → price, add pax column.
--
-- All statements are IDEMPOTENT (IF [NOT] EXISTS / IF column exists).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── STEP 1: Add new fields to packages ────────────────────────────────────
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "pax" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "margin" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "selling_price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "term_and_condition" TEXT;

-- ─── STEP 2: Rename package_variant_category_prices → package_category_prices ─
-- (rename only if old table exists and new does not)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'package_variant_category_prices')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'package_category_prices') THEN
    ALTER TABLE "package_variant_category_prices" RENAME TO "package_category_prices";
  END IF;
END $$;

-- Create package_category_prices if it doesn't exist at all
CREATE TABLE IF NOT EXISTS "package_category_prices" (
    "id"           TEXT NOT NULL,
    "packageId"    TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "basePrice"    INTEGER NOT NULL DEFAULT 0,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "isShow"       BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "package_category_prices_pkey" PRIMARY KEY ("id")
);

-- Re-point packageId column: add if missing
ALTER TABLE "package_category_prices" ADD COLUMN IF NOT EXISTS "packageId" TEXT;

-- Drop old FK to package_variants if exists
ALTER TABLE "package_category_prices" DROP CONSTRAINT IF EXISTS "package_variant_category_prices_packageVariantId_fkey";
ALTER TABLE "package_category_prices" DROP CONSTRAINT IF EXISTS "package_category_prices_packageVariantId_fkey";

-- Drop old packageVariantId column if exists
ALTER TABLE "package_category_prices" DROP COLUMN IF EXISTS "packageVariantId";

-- Add FK to packages
ALTER TABLE "package_category_prices" DROP CONSTRAINT IF EXISTS "package_category_prices_packageId_fkey";
ALTER TABLE "package_category_prices" ADD CONSTRAINT "package_category_prices_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "package_category_prices_packageId_idx"
    ON "package_category_prices"("packageId");

-- ─── STEP 3: Re-point PackageVendorItem from variant to package ─────────────
-- Add new packageId column to package_vendor_items
ALTER TABLE "package_vendor_items" ADD COLUMN IF NOT EXISTS "packageId" TEXT;

-- Drop old FK to package_variants
ALTER TABLE "package_vendor_items" DROP CONSTRAINT IF EXISTS "package_vendor_items_packageVariantId_fkey";

-- Drop old packageVariantId column
ALTER TABLE "package_vendor_items" DROP COLUMN IF EXISTS "packageVariantId";

-- Add FK to packages
ALTER TABLE "package_vendor_items" DROP CONSTRAINT IF EXISTS "package_vendor_items_packageId_fkey";
ALTER TABLE "package_vendor_items" ADD CONSTRAINT "package_vendor_items_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "package_vendor_items_packageId_idx"
    ON "package_vendor_items"("packageId");

-- ─── STEP 4: Re-point PackageInternalItem from variant to package ───────────
ALTER TABLE "package_internal_items" ADD COLUMN IF NOT EXISTS "packageId" TEXT;

ALTER TABLE "package_internal_items" DROP CONSTRAINT IF EXISTS "package_internal_items_packageVariantId_fkey";
ALTER TABLE "package_internal_items" DROP COLUMN IF EXISTS "packageVariantId";

ALTER TABLE "package_internal_items" DROP CONSTRAINT IF EXISTS "package_internal_items_packageId_fkey";
ALTER TABLE "package_internal_items" ADD CONSTRAINT "package_internal_items_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "package_internal_items_packageId_idx"
    ON "package_internal_items"("packageId");

-- ─── STEP 5: Drop Booking.packageVariantId FK + column ──────────────────────
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_packageVariantId_fkey";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "packageVariantId";

-- ─── STEP 6: BookingRevision — add pax + price, keep old columns as nullable ─
ALTER TABLE "booking_revisions" ADD COLUMN IF NOT EXISTS "pax"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_revisions" ADD COLUMN IF NOT EXISTS "price" INTEGER NOT NULL DEFAULT 0;

-- Migrate data: copy variantPrice → price if old column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_revisions' AND column_name = 'variantPrice'
  ) THEN
    UPDATE "booking_revisions" SET "price" = "variantPrice" WHERE "price" = 0;
  END IF;
END $$;

-- Drop old variant columns (nullable now for safety)
ALTER TABLE "booking_revisions" DROP COLUMN IF EXISTS "variantId";
ALTER TABLE "booking_revisions" DROP COLUMN IF EXISTS "variantName";
ALTER TABLE "booking_revisions" DROP COLUMN IF EXISTS "variantPrice";

-- ─── STEP 7: Drop package_variants table (LAST — after all FK deps gone) ────
-- First remove any remaining FK references to package_variants
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint
        WHERE confrelid = 'package_variants'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
    END LOOP;
END $$;

DROP TABLE IF EXISTS "package_variants";
