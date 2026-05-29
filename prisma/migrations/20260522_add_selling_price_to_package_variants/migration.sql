-- Add sellingPrice column (exact selling price, source of truth)
ALTER TABLE "package_variants" ADD COLUMN IF NOT EXISTS "sellingPrice" INTEGER NOT NULL DEFAULT 0;

-- Backfill: compute sellingPrice from existing margin + category base prices
UPDATE "package_variants" pv
SET "sellingPrice" = sub.base + ROUND(sub.base * (pv.margin / 100))
FROM (
  SELECT "packageVariantId", COALESCE(SUM("basePrice"), 0)::INTEGER AS base
  FROM "package_variant_category_prices"
  GROUP BY "packageVariantId"
) sub
WHERE pv.id = sub."packageVariantId"
  AND pv."sellingPrice" = 0;
