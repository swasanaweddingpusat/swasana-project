-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "PayableType" AS ENUM ('program_cashback', 'overpay_refund');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "PayableStatus" AS ENUM ('outstanding', 'paid', 'void');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "booking_payables" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "PayableType" NOT NULL,
    "programId" TEXT,
    "sourceLedgerId" TEXT,
    "settlementLedgerId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'outstanding',
    "paymentMethodId" TEXT,
    "disbursementNumber" TEXT,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "booking_payables_settlementLedgerId_key" ON "booking_payables"("settlementLedgerId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "booking_payables_disbursementNumber_key" ON "booking_payables"("disbursementNumber");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "booking_payables_bookingId_status_idx" ON "booking_payables"("bookingId", "status");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "booking_payables_programId_idx" ON "booking_payables"("programId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "booking_payables_sourceLedgerId_idx" ON "booking_payables"("sourceLedgerId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "booking_payables_paymentMethodId_idx" ON "booking_payables"("paymentMethodId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "discount_programs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_sourceLedgerId_fkey"
    FOREIGN KEY ("sourceLedgerId") REFERENCES "ledgers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_settlementLedgerId_fkey"
    FOREIGN KEY ("settlementLedgerId") REFERENCES "ledgers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_settledById_fkey"
    FOREIGN KEY ("settledById") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "booking_payables"
    ADD CONSTRAINT "booking_payables_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
