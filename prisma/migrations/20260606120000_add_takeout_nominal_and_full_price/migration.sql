-- Add takeoutNominal to snap_package_category_prices (per-category takeout amount)
ALTER TABLE "snap_package_category_prices"
  ADD COLUMN IF NOT EXISTS "takeoutNominal" INTEGER NOT NULL DEFAULT 0;

-- Add fullPrice to snap_package_pricing (invariant anchor: price before any takeout)
ALTER TABLE "snap_package_pricing"
  ADD COLUMN IF NOT EXISTS "fullPrice" INTEGER NOT NULL DEFAULT 0;

-- Backfill takeoutNominal: existing takeout categories are filled with basePrice,
-- replicating the legacy behaviour of deducting the full category price.
UPDATE "snap_package_category_prices"
  SET "takeoutNominal" = "basePrice"
  WHERE "isTakeout" = true AND "takeoutNominal" = 0;

-- Backfill anchor: fullPrice = price + SUM(takeoutNominal of takeout categories) per booking.
-- This guarantees final = fullPrice - SUM(takeout) == legacy price, so historical
-- bookings render identically and un-takeout restores the correct original price.
UPDATE "snap_package_pricing" sp
  SET "fullPrice" = sp."price" + COALESCE((
    SELECT SUM(cp."takeoutNominal")
    FROM "snap_package_category_prices" cp
    WHERE cp."bookingId" = sp."bookingId" AND cp."isTakeout" = true
  ), 0)
  WHERE sp."fullPrice" = 0;
