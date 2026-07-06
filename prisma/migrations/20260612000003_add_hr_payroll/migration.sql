-- CreateEnum PayrollStatus
DO $$ BEGIN
  CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'PUBLISHED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable payroll_records
CREATE TABLE IF NOT EXISTS "payroll_records" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "allowances" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(15,2) NOT NULL,
    "totalDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(15,2) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "actualDaysWorked" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable tax_configs
CREATE TABLE IF NOT EXISTS "tax_configs" (
    "id" TEXT NOT NULL,
    "ptkpCategory" TEXT NOT NULL,
    "ptkpAmount" DECIMAL(15,2) NOT NULL,
    "bpjsHealthRate" DOUBLE PRECISION NOT NULL,
    "bpjsEmployeeRate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_records_profileId_periodMonth_periodYear_key"
  ON "payroll_records"("profileId", "periodMonth", "periodYear");
