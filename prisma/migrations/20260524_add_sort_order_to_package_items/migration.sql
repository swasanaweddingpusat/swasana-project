-- Migration: add_sort_order_to_package_items
-- Adds sortOrder field to PackageVendorItem and PackageInternalItem
-- Idempotent: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE "package_vendor_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "package_internal_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows: set sortOrder based on createdAt order within each variant
UPDATE "package_vendor_items" pvi
SET "sortOrder" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "packageVariantId" ORDER BY "createdAt") AS rn
  FROM "package_vendor_items"
) sub
WHERE pvi.id = sub.id;

UPDATE "package_internal_items" pii
SET "sortOrder" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "packageVariantId" ORDER BY "createdAt") AS rn
  FROM "package_internal_items"
) sub
WHERE pii.id = sub.id;
