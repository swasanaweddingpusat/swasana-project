-- Quotation tracks whether it was built from a MICE package or custom line items.
-- "meeting-package" | "custom".

ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "packageSource" TEXT;
