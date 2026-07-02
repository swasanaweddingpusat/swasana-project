-- Add per-term payment method (bank tujuan transfer) to term_of_payments.
-- Nullable FK to payment_methods, ON DELETE SET NULL so deleting a bank
-- account never breaks a term row.

ALTER TABLE "term_of_payments" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;

CREATE INDEX IF NOT EXISTS "term_of_payments_paymentMethodId_idx"
  ON "term_of_payments" ("paymentMethodId");

ALTER TABLE "term_of_payments"
  DROP CONSTRAINT IF EXISTS "term_of_payments_paymentMethodId_fkey";

ALTER TABLE "term_of_payments"
  ADD CONSTRAINT "term_of_payments_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: seed each existing term with the booking-level payment method
-- (the single bank previously used for the whole booking) so already-paid
-- terms are not left blank in the per-term UI.
UPDATE "term_of_payments" t
SET "paymentMethodId" = b."paymentMethodId"
FROM "bookings" b
WHERE t."bookingId" = b."id"
  AND t."paymentMethodId" IS NULL
  AND b."paymentMethodId" IS NOT NULL;
