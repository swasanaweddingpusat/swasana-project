-- CreateEnum: DiscountType (idempotent)
DO $$ BEGIN
    CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'NOMINAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: discount_programs (idempotent)
CREATE TABLE IF NOT EXISTS "discount_programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minTransaction" INTEGER,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "eventEligibleStart" TIMESTAMP(3),
    "eventEligibleEnd" TIMESTAMP(3),
    "quota" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "discount_programs_isActive_idx" ON "discount_programs"("isActive");
CREATE INDEX IF NOT EXISTS "discount_programs_periodStart_periodEnd_idx" ON "discount_programs"("periodStart", "periodEnd");
