-- Add isShow to package_variant_category_prices
ALTER TABLE "package_variant_category_prices" ADD COLUMN IF NOT EXISTS "isShow" BOOLEAN NOT NULL DEFAULT true;

-- Add margin to snap_package_variants
ALTER TABLE "snap_package_variants" ADD COLUMN IF NOT EXISTS "margin" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create snap_package_category_prices
CREATE TABLE IF NOT EXISTS "snap_package_category_prices" (
  "id"           TEXT         NOT NULL,
  "bookingId"    TEXT         NOT NULL,
  "categoryName" TEXT         NOT NULL,
  "basePrice"    INTEGER      NOT NULL DEFAULT 0,
  "sortOrder"    INTEGER      NOT NULL DEFAULT 0,
  "isShow"       BOOLEAN      NOT NULL DEFAULT true,
  "isTakeout"    BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "snap_package_category_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "snap_package_category_prices_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "snap_package_category_prices_bookingId_idx"
  ON "snap_package_category_prices"("bookingId");

-- Add refund to TermOfPaymentStatus enum
ALTER TYPE "TermOfPaymentStatus" ADD VALUE IF NOT EXISTS 'refund';
