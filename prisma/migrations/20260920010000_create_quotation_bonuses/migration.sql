-- Quotation-level Bonus items, parallel to the existing "quotation_complimentaries"
-- table. Previously Quotation had no real Bonus support — the drawer UI mislabeled
-- its Complimentary block as "Bonus". This table backs the new, genuine Bonus tab.
-- No isShowPrice column: unlike Complimentary, Bonus has no show/hide-price concept.

CREATE TABLE IF NOT EXISTS "quotation_bonuses" (
  "id"          TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "bonusId"     TEXT,
  "name"        TEXT NOT NULL,
  "price"       INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "qty"         INTEGER NOT NULL DEFAULT 1,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "quotation_bonuses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quotation_bonuses_quotationId_idx" ON "quotation_bonuses"("quotationId");
CREATE INDEX IF NOT EXISTS "quotation_bonuses_bonusId_idx" ON "quotation_bonuses"("bonusId");

DO $$ BEGIN
  ALTER TABLE "quotation_bonuses"
    ADD CONSTRAINT "quotation_bonuses_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "quotations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_bonuses"
    ADD CONSTRAINT "quotation_bonuses_bonusId_fkey"
    FOREIGN KEY ("bonusId") REFERENCES "bonuses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
