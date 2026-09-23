-- Package (MICE drawer, Step 4 "Payment") gains a Security Deposit amount and a
-- Cancellation & Refund Policy rich-text field, mirroring termAndCondition
-- (nullable, same gating). Also adds the Step 2 "Tax & Deposit" sub-collection,
-- mirroring package_mice_items' shape/conventions exactly (plain name + one
-- numeric column, sortOrder-driven).

-- 1. packages.securityDeposit (whole Rupiah, matches package_mice_prices.total convention)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "securityDeposit" INTEGER NOT NULL DEFAULT 0;

-- 2. packages.cancellationRefundPolicy (nullable, mirrors termAndCondition)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "cancellationRefundPolicy" TEXT;

-- 3. package_mice_tax_deposits
CREATE TABLE IF NOT EXISTS "package_mice_tax_deposits" (
    "id"        TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "nominal"   INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_mice_tax_deposits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "package_mice_tax_deposits_packageId_idx" ON "package_mice_tax_deposits"("packageId");

DO $$ BEGIN
  ALTER TABLE "package_mice_tax_deposits"
    ADD CONSTRAINT "package_mice_tax_deposits_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
