-- CreateEnum VoucherType (idempotent)
DO $$ BEGIN
  CREATE TYPE "VoucherType" AS ENUM ('payment_discount', 'cashback');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddColumn type to discount_programs (idempotent)
ALTER TABLE "discount_programs"
  ADD COLUMN IF NOT EXISTS "type" "VoucherType" NOT NULL DEFAULT 'payment_discount';
