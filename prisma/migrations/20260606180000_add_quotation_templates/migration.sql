-- Quotation templates (per venue) + template items. Idempotent.

CREATE TABLE IF NOT EXISTS "quotation_templates" (
  "id"              TEXT NOT NULL,
  "venueId"         TEXT NOT NULL,
  "paymentMethodId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quotation_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quotation_templates_venueId_key" ON "quotation_templates"("venueId");
CREATE INDEX IF NOT EXISTS "quotation_templates_paymentMethodId_idx" ON "quotation_templates"("paymentMethodId");

CREATE TABLE IF NOT EXISTS "quotation_template_items" (
  "id"          TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "qty"         INTEGER NOT NULL DEFAULT 0,
  "price"       INTEGER NOT NULL DEFAULT 0,
  "total"       INTEGER NOT NULL DEFAULT 0,
  "manualTotal" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quotation_template_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quotation_template_items_templateId_idx" ON "quotation_template_items"("templateId");

-- FKs
ALTER TABLE "quotation_templates" DROP CONSTRAINT IF EXISTS "quotation_templates_venueId_fkey";
ALTER TABLE "quotation_templates"
  ADD CONSTRAINT "quotation_templates_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotation_templates" DROP CONSTRAINT IF EXISTS "quotation_templates_paymentMethodId_fkey";
ALTER TABLE "quotation_templates"
  ADD CONSTRAINT "quotation_templates_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotation_template_items" DROP CONSTRAINT IF EXISTS "quotation_template_items_templateId_fkey";
ALTER TABLE "quotation_template_items"
  ADD CONSTRAINT "quotation_template_items_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "quotation_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
