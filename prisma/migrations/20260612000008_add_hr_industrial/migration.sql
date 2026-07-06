DO $$ BEGIN CREATE TYPE "ReimbursementStatus" AS ENUM ('PENDING','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LoanStatus" AS ENUM ('PENDING','ACTIVE','COMPLETED','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisputeType" AS ENUM ('INDIVIDUAL','COLLECTIVE','PROCEDURAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisputeStatus" AS ENUM ('PENDING','IN_PROGRESS','RESOLVED','IN_REVIEW','UNDER_INVESTIGATION','ESCALATED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "reimbursements" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_loans" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "tenor" INTEGER NOT NULL,
    "monthlyInstallment" DECIMAL(15,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "labor_disputes" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "disputeType" "DisputeType" NOT NULL,
    "dateFiled" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "labor_disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_grievances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateFiled" TIMESTAMP(3) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_grievances_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "labor_disputes" ADD CONSTRAINT "labor_disputes_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_grievances" ADD CONSTRAINT "employee_grievances_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "reimbursements_profileId_idx" ON "reimbursements"("profileId");
CREATE INDEX IF NOT EXISTS "employee_loans_profileId_idx" ON "employee_loans"("profileId");
CREATE INDEX IF NOT EXISTS "labor_disputes_profileId_idx" ON "labor_disputes"("profileId");
CREATE INDEX IF NOT EXISTS "employee_grievances_profileId_idx" ON "employee_grievances"("profileId");
