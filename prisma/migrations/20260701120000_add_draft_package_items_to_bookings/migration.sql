-- Migration: add_draft_package_items_to_bookings
-- Adds draft-only JSON columns for editable package items during the multi-step
-- booking form. Mirrors draftCategoryToggles / draftComplimentaries: populated
-- while recordStatus = 'draft', snapshotted into snap_package_* on finalize.
--   draftInternalItems: { itemName, itemDescription }[]
--   draftVendorItems:   { categoryId, categoryName, itemText }[]

-- Add columns (idempotent)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "draftInternalItems" JSONB;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "draftVendorItems" JSONB;
