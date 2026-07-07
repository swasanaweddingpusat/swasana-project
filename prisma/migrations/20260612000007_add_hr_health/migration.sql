DO $$ BEGIN CREATE TYPE "HealthStatus" AS ENUM ('NORMAL','SELESAI','PERLU_TINDAK_LANJUT','URGENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InsuranceStatus" AS ENUM ('AKTIF','BERAKHIR','EXPIRED','PENDING','NON_AKTIF'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "health_records" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "checkupType" TEXT NOT NULL,
    "checkupDate" TIMESTAMP(3) NOT NULL,
    "doctorName" TEXT,
    "findings" TEXT,
    "status" "HealthStatus" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_insurances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "insuranceType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "coverageAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "status" "InsuranceStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_insurances_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "health_records" ADD CONSTRAINT "health_records_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_insurances" ADD CONSTRAINT "employee_insurances_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "health_records_profileId_idx" ON "health_records"("profileId");
CREATE INDEX IF NOT EXISTS "employee_insurances_profileId_idx" ON "employee_insurances"("profileId");
