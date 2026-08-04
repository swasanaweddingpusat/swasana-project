-- Add bookingFee to quotations + quotation_templates.
-- Booking fee drives the Term & Payment boilerplate line
-- ("Booking Fee of Rp X is required to confirm the reservation").
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "bookingFee" INTEGER;
ALTER TABLE "quotation_templates" ADD COLUMN IF NOT EXISTS "bookingFee" INTEGER;
