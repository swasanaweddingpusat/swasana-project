-- Add quotation_terms.paymentEvidence (R2 key). Idempotent.
ALTER TABLE "quotation_terms" ADD COLUMN IF NOT EXISTS "paymentEvidence" TEXT;
