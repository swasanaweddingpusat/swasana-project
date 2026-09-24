-- Barcode placement box on festivals.backgroundImageKey, stored as
-- fractions (0..1) of the original image width/height.
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "barcodeBoxX" DOUBLE PRECISION;
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "barcodeBoxY" DOUBLE PRECISION;
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "barcodeBoxWidth" DOUBLE PRECISION;
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "barcodeBoxHeight" DOUBLE PRECISION;
