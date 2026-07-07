-- CreateEnum: LeaveRequestStatus
DO $$ BEGIN
  CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'manager_approved', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: leave_types
CREATE TABLE IF NOT EXISTS "leave_types" (
    "id"                    TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "code"                  TEXT NOT NULL,
    "description"           TEXT,
    "defaultQuota"          INTEGER NOT NULL DEFAULT 0,
    "isDeductible"          BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval"      BOOLEAN NOT NULL DEFAULT true,
    "maxConsecutiveDays"    INTEGER,
    "minDaysBeforeRequest"  INTEGER NOT NULL DEFAULT 0,
    "isCarryOver"           BOOLEAN NOT NULL DEFAULT false,
    "carryOverMaxDays"      INTEGER,
    "carryOverExpiryMonths" INTEGER,
    "isActive"              BOOLEAN NOT NULL DEFAULT true,
    "isSystemType"          BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"             INTEGER NOT NULL DEFAULT 0,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_name_key" ON "leave_types"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_code_key" ON "leave_types"("code");

-- CreateTable: leave_balances
CREATE TABLE IF NOT EXISTS "leave_balances" (
    "id"             TEXT NOT NULL,
    "profileId"      TEXT NOT NULL,
    "leaveTypeId"    TEXT NOT NULL,
    "year"           INTEGER NOT NULL,
    "totalDays"      INTEGER NOT NULL DEFAULT 0,
    "usedDays"       INTEGER NOT NULL DEFAULT 0,
    "carryOverDays"  INTEGER NOT NULL DEFAULT 0,
    "adjustmentDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_profileId_leaveTypeId_year_key"
  ON "leave_balances"("profileId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "leave_balances_profileId_idx" ON "leave_balances"("profileId");
CREATE INDEX IF NOT EXISTS "leave_balances_leaveTypeId_idx" ON "leave_balances"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "leave_balances_year_idx" ON "leave_balances"("year");

-- CreateTable: leave_requests
CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id"                 TEXT NOT NULL,
    "profileId"          TEXT NOT NULL,
    "leaveTypeId"        TEXT NOT NULL,
    "startDate"          TIMESTAMP(3) NOT NULL,
    "endDate"            TIMESTAMP(3) NOT NULL,
    "totalDays"          INTEGER NOT NULL,
    "reason"             TEXT,
    "status"             "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "managerApprovedBy"  TEXT,
    "managerApprovedAt"  TIMESTAMP(3),
    "managerNote"        TEXT,
    "hrApprovedBy"       TEXT,
    "hrApprovedAt"       TIMESTAMP(3),
    "hrNote"             TEXT,
    "rejectedBy"         TEXT,
    "rejectedAt"         TIMESTAMP(3),
    "rejectionReason"    TEXT,
    "cancelledAt"        TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_requests_profileId_idx" ON "leave_requests"("profileId");
CREATE INDEX IF NOT EXISTS "leave_requests_leaveTypeId_idx" ON "leave_requests"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX IF NOT EXISTS "leave_requests_startDate_idx" ON "leave_requests"("startDate");
CREATE INDEX IF NOT EXISTS "leave_requests_endDate_idx" ON "leave_requests"("endDate");

-- AddForeignKeys: leave_balances
DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKeys: leave_requests
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_managerApprovedBy_fkey"
    FOREIGN KEY ("managerApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hrApprovedBy_fkey"
    FOREIGN KEY ("hrApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_rejectedBy_fkey"
    FOREIGN KEY ("rejectedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
