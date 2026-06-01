-- Carry categoryId into booking snapshots so snapshot data is identifiable by the
-- global Category id (consistent with master), not only the categoryName string.
-- Snapshots are frozen records, so this is a plain nullable column (no FK).
-- Idempotent.

ALTER TABLE "snap_package_category_prices" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "snap_package_vendor_items"    ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
