-- Migration: drop_item_type_price_from_package_mice_item
-- Idempotent: uses IF EXISTS guards.
--
-- DESTRUCTIVE: this drops the itemType/itemPrice columns on package_mice_items,
-- which currently hold 32 non-null seeded values (per-item pricing on the 8
-- seeded MICE packages). This is an explicit, user-confirmed decision — MICE
-- package items no longer carry their own price; pricing is set at the
-- package level via the "Set Harga" drawer (categoryPrices / sellingPrice).

-- ─── package_mice_items ───────────────────────────────────────────────────────

ALTER TABLE "package_mice_items" DROP COLUMN IF EXISTS "itemType";
ALTER TABLE "package_mice_items" DROP COLUMN IF EXISTS "itemPrice";

-- ─── Enum ────────────────────────────────────────────────────────────────────
-- MiceItemPriceType was only ever used by package_mice_items.itemType.

DROP TYPE IF EXISTS "MiceItemPriceType";
