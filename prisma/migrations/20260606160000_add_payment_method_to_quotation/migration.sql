-- Add quotations.paymentMethodId (nullable) + FK ON DELETE SET NULL. Idempotent.

ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;

CREATE INDEX IF NOT EXISTS "quotations_paymentMethodId_idx" ON "quotations"("paymentMethodId");

ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_paymentMethodId_fkey";
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
