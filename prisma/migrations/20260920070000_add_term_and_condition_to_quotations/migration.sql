-- Quotation gains a full rich-text "Term & Payment" paragraph that, when set,
-- overrides the auto-generated bookingFee + paymentNote boilerplate in the
-- preview document.

ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "termAndCondition" TEXT;
