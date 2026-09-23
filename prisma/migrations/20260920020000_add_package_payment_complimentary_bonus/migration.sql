-- Package (MICE drawer) gains its own Payment (bank account) + Complimentary/Bonus
-- lineup, mirroring Quotation's existing paymentMethodId + QuotationComplimentary/
-- QuotationBonus tables. packageComplimentaries has isShowPrice (matches Complimentary
-- master); packageBonuses does not (matches Bonus master — no show/hide-price concept).

-- 1. packages.paymentMethodId (nullable FK -> payment_methods)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;

DO $$ BEGIN
  ALTER TABLE "packages"
    ADD CONSTRAINT "packages_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "packages_paymentMethodId_idx" ON "packages"("paymentMethodId");

-- 2. package_complimentaries
CREATE TABLE IF NOT EXISTS "package_complimentaries" (
  "id"              TEXT NOT NULL,
  "packageId"       TEXT NOT NULL,
  "complimentaryId" TEXT,
  "name"            TEXT NOT NULL,
  "price"           INTEGER NOT NULL DEFAULT 0,
  "isShowPrice"     BOOLEAN NOT NULL DEFAULT false,
  "description"     TEXT,
  "qty"             INTEGER NOT NULL DEFAULT 1,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "package_complimentaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "package_complimentaries_packageId_idx" ON "package_complimentaries"("packageId");
CREATE INDEX IF NOT EXISTS "package_complimentaries_complimentaryId_idx" ON "package_complimentaries"("complimentaryId");

DO $$ BEGIN
  ALTER TABLE "package_complimentaries"
    ADD CONSTRAINT "package_complimentaries_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "package_complimentaries"
    ADD CONSTRAINT "package_complimentaries_complimentaryId_fkey"
    FOREIGN KEY ("complimentaryId") REFERENCES "complimentaries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. package_bonuses
CREATE TABLE IF NOT EXISTS "package_bonuses" (
  "id"          TEXT NOT NULL,
  "packageId"   TEXT NOT NULL,
  "bonusId"     TEXT,
  "name"        TEXT NOT NULL,
  "price"       INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "qty"         INTEGER NOT NULL DEFAULT 1,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "package_bonuses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "package_bonuses_packageId_idx" ON "package_bonuses"("packageId");
CREATE INDEX IF NOT EXISTS "package_bonuses_bonusId_idx" ON "package_bonuses"("bonusId");

DO $$ BEGIN
  ALTER TABLE "package_bonuses"
    ADD CONSTRAINT "package_bonuses_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "package_bonuses"
    ADD CONSTRAINT "package_bonuses_bonusId_fkey"
    FOREIGN KEY ("bonusId") REFERENCES "bonuses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
