-- Quotation gains three editable document clauses, each falling back to a
-- hardcoded default string in quotation-preview.tsx when null (legacy rows /
-- not yet customized): remaining-payment sub-note, Cancellation & Refund
-- Policy paragraph, and the Closing paragraph before the signature block.

ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "paymentNote" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "cancellationPolicy" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "closingNote" TEXT;
