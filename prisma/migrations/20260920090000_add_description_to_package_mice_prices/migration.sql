-- Add an optional "description" to MICE price items (the "Harga" step), so each
-- price row (e.g. "Bundle Package") can carry a short note about what it covers.

ALTER TABLE "package_mice_prices" ADD COLUMN IF NOT EXISTS "description" TEXT;
