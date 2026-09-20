-- Quotation becomes MICE-only + gains editable "Harga"/"Tax & Deposit" tables
-- and a frozen package snapshot (snap_quotation_packages + children).

-- 1. Drop wedding-specific columns (PostgreSQL drops the dependent composite
--    index that referenced "category" automatically).
ALTER TABLE "quotations" DROP COLUMN IF EXISTS "category";
ALTER TABLE "quotations" DROP COLUMN IF EXISTS "weddingSession";

-- 2. Selected MICE package reference (identity snapshot on the quotation row).
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "packageId" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "packageName" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "pax" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "discountName" TEXT;

-- 3. QuotationItem.type — distinguishes regular items vs "Additional" rows.
DO $$ BEGIN
  CREATE TYPE "QuotationItemType" AS ENUM ('ITEM', 'ADDITIONAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "type" "QuotationItemType" NOT NULL DEFAULT 'ITEM';

-- 4. Editable "Harga" (QuotationPrice).
CREATE TABLE IF NOT EXISTS "quotation_prices" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceType" "MicePriceType" NOT NULL DEFAULT 'QTY',
    "qty" INTEGER,
    "price" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quotation_prices_quotationId_idx" ON "quotation_prices"("quotationId");
DO $$ BEGIN
  ALTER TABLE "quotation_prices" ADD CONSTRAINT "quotation_prices_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Editable "Tax & Deposit" (QuotationTaxDeposit).
CREATE TABLE IF NOT EXISTS "quotation_tax_deposits" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_tax_deposits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quotation_tax_deposits_quotationId_idx" ON "quotation_tax_deposits"("quotationId");
DO $$ BEGIN
  ALTER TABLE "quotation_tax_deposits" ADD CONSTRAINT "quotation_tax_deposits_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Package snapshot (main).
CREATE TABLE IF NOT EXISTS "snap_quotation_packages" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "packageId" TEXT,
    "packageName" TEXT NOT NULL,
    "pax" INTEGER NOT NULL DEFAULT 0,
    "venueId" TEXT,
    "venueName" TEXT,
    "eventTypeId" TEXT,
    "eventTypeName" TEXT,
    "paymentMethodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snap_quotation_packages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "snap_quotation_packages_quotationId_key" ON "snap_quotation_packages"("quotationId");
DO $$ BEGIN
  ALTER TABLE "snap_quotation_packages" ADD CONSTRAINT "snap_quotation_packages_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6a. Snapshot items.
CREATE TABLE IF NOT EXISTS "snap_quotation_package_items" (
    "id" TEXT NOT NULL,
    "snapPackageId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "snap_quotation_package_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "snap_quotation_package_items_snapPackageId_idx" ON "snap_quotation_package_items"("snapPackageId");
DO $$ BEGIN
  ALTER TABLE "snap_quotation_package_items" ADD CONSTRAINT "snap_quotation_package_items_snapPackageId_fkey"
    FOREIGN KEY ("snapPackageId") REFERENCES "snap_quotation_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6b. Snapshot prices.
CREATE TABLE IF NOT EXISTS "snap_quotation_package_prices" (
    "id" TEXT NOT NULL,
    "snapPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceType" "MicePriceType" NOT NULL DEFAULT 'QTY',
    "qty" INTEGER,
    "price" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "snap_quotation_package_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "snap_quotation_package_prices_snapPackageId_idx" ON "snap_quotation_package_prices"("snapPackageId");
DO $$ BEGIN
  ALTER TABLE "snap_quotation_package_prices" ADD CONSTRAINT "snap_quotation_package_prices_snapPackageId_fkey"
    FOREIGN KEY ("snapPackageId") REFERENCES "snap_quotation_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6c. Snapshot tax & deposit.
CREATE TABLE IF NOT EXISTS "snap_quotation_package_tax_deposits" (
    "id" TEXT NOT NULL,
    "snapPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "snap_quotation_package_tax_deposits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "snap_quotation_package_tax_deposits_snapPackageId_idx" ON "snap_quotation_package_tax_deposits"("snapPackageId");
DO $$ BEGIN
  ALTER TABLE "snap_quotation_package_tax_deposits" ADD CONSTRAINT "snap_quotation_package_tax_deposits_snapPackageId_fkey"
    FOREIGN KEY ("snapPackageId") REFERENCES "snap_quotation_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6d. Snapshot complimentaries.
CREATE TABLE IF NOT EXISTS "snap_quotation_package_complimentaries" (
    "id" TEXT NOT NULL,
    "snapPackageId" TEXT NOT NULL,
    "complimentaryId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isShowPrice" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "snap_quotation_package_complimentaries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "snap_quotation_package_complimentaries_snapPackageId_idx" ON "snap_quotation_package_complimentaries"("snapPackageId");
DO $$ BEGIN
  ALTER TABLE "snap_quotation_package_complimentaries" ADD CONSTRAINT "snap_quotation_package_complimentaries_snapPackageId_fkey"
    FOREIGN KEY ("snapPackageId") REFERENCES "snap_quotation_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6e. Snapshot bonuses.
CREATE TABLE IF NOT EXISTS "snap_quotation_package_bonuses" (
    "id" TEXT NOT NULL,
    "snapPackageId" TEXT NOT NULL,
    "bonusId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "snap_quotation_package_bonuses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "snap_quotation_package_bonuses_snapPackageId_idx" ON "snap_quotation_package_bonuses"("snapPackageId");
DO $$ BEGIN
  ALTER TABLE "snap_quotation_package_bonuses" ADD CONSTRAINT "snap_quotation_package_bonuses_snapPackageId_fkey"
    FOREIGN KEY ("snapPackageId") REFERENCES "snap_quotation_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
