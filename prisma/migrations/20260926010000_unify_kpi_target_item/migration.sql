-- Unify KpiTargetItem: one row now covers dealing + omset + homebase
-- (previously one row = one indicator, chosen via indicatorType/type).
-- Demo/seed data only, no production data to preserve — destructive alter is safe.

-- 1. Add new unified per-indicator columns
ALTER TABLE "kpi_target_items"
  ADD COLUMN IF NOT EXISTS "dealingQty" INTEGER,
  ADD COLUMN IF NOT EXISTS "dealingQtyReguler" INTEGER,
  ADD COLUMN IF NOT EXISTS "dealingQtyHadjatan" INTEGER,
  ADD COLUMN IF NOT EXISTS "omsetPrice" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "omsetPriceReguler" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "omsetPriceHadjatan" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "homebaseQty" INTEGER,
  ADD COLUMN IF NOT EXISTS "homebaseQtyReguler" INTEGER,
  ADD COLUMN IF NOT EXISTS "homebaseQtyHadjatan" INTEGER;

-- 2. Drop old single-indicator columns
ALTER TABLE "kpi_target_items"
  DROP COLUMN IF EXISTS "indicatorType",
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "qty",
  DROP COLUMN IF EXISTS "price",
  DROP COLUMN IF EXISTS "qtyReguler",
  DROP COLUMN IF EXISTS "qtyHadjatan",
  DROP COLUMN IF EXISTS "priceReguler",
  DROP COLUMN IF EXISTS "priceHadjatan";

-- 3. Drop the now-unused enum (KpiIndicatorType is still used by KpiCalculationDetail — keep it)
DROP TYPE IF EXISTS "KpiTargetType";
