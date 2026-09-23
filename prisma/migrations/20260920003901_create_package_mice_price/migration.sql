-- Migration: create_package_mice_price
-- Idempotent: uses IF NOT EXISTS guards.
--
-- New "Harga" step for Package MICE — a separate collection from
-- package_mice_items (which is deliberately plain name+description, no
-- pricing). QTY rows carry qty+price (total = qty*price computed client-side);
-- NOMINAL rows carry only a directly-editable total (qty/price stay NULL).

-- ─── Enum ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "MicePriceType" AS ENUM ('QTY', 'NOMINAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── package_mice_prices ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "package_mice_prices" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceType" "MicePriceType" NOT NULL DEFAULT 'QTY',
    "qty" INTEGER,
    "price" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_mice_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "package_mice_prices_packageId_idx" ON "package_mice_prices"("packageId");

DO $$ BEGIN
  ALTER TABLE "package_mice_prices" ADD CONSTRAINT "package_mice_prices_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
