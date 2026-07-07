-- Add on_leave to AttendanceStatus enum
DO $$ BEGIN
  ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'on_leave';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: LeaveRequestStatus
DO $$ BEGIN
  CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'manager_approved', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop old leave tables from previous migration (different schema)
DROP TABLE IF EXISTS "leave_balances" CASCADE;
DROP TABLE IF EXISTS "leave_requests" CASCADE;

-- CreateTable: leave_types
CREATE TABLE IF NOT EXISTS "leave_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "defaultQuota" INTEGER NOT NULL DEFAULT 0,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxConsecutiveDays" INTEGER,
    "minDaysBeforeRequest" INTEGER NOT NULL DEFAULT 0,
    "isCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "carryOverMaxDays" INTEGER,
    "carryOverExpiryMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystemType" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_name_key" ON "leave_types"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_code_key" ON "leave_types"("code");

-- CreateTable: leave_balances
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "usedDays" INTEGER NOT NULL DEFAULT 0,
    "carryOverDays" INTEGER NOT NULL DEFAULT 0,
    "adjustmentDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_profileId_leaveTypeId_year_key" ON "leave_balances"("profileId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "leave_balances_profileId_idx" ON "leave_balances"("profileId");
CREATE INDEX IF NOT EXISTS "leave_balances_leaveTypeId_idx" ON "leave_balances"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "leave_balances_year_idx" ON "leave_balances"("year");

-- CreateTable: leave_requests
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "managerNote" TEXT,
    "hrApprovedBy" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrNote" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_requests_profileId_idx" ON "leave_requests"("profileId");
CREATE INDEX IF NOT EXISTS "leave_requests_leaveTypeId_idx" ON "leave_requests"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX IF NOT EXISTS "leave_requests_startDate_idx" ON "leave_requests"("startDate");
CREATE INDEX IF NOT EXISTS "leave_requests_endDate_idx" ON "leave_requests"("endDate");

-- AddForeignKeys: leave_balances
DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKeys: leave_requests
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_managerApprovedBy_fkey" FOREIGN KEY ("managerApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hrApprovedBy_fkey" FOREIGN KEY ("hrApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed preset leave types
INSERT INTO "leave_types" (id, name, code, description, "defaultQuota", "isDeductible", "requiresApproval", "maxConsecutiveDays", "minDaysBeforeRequest", "isCarryOver", "carryOverMaxDays", "isActive", "isSystemType", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Cuti Tahunan', 'annual', 'Cuti tahunan sesuai UU Ketenagakerjaan', 12, true, true, NULL, 3, true, 6, true, true, 1, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Sakit', 'sick', 'Cuti sakit dengan surat dokter', 14, true, true, NULL, 0, false, NULL, true, true, 2, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Melahirkan', 'maternity', 'Cuti melahirkan 3 bulan', 90, false, true, 90, 14, false, NULL, true, true, 3, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Ayah', 'paternity', 'Cuti kelahiran anak untuk ayah', 2, false, true, 2, 0, false, NULL, true, true, 4, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Menikah', 'marriage', 'Cuti pernikahan karyawan', 3, false, true, 3, 7, false, NULL, true, true, 5, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Keluarga Meninggal', 'bereavement', 'Cuti duka keluarga meninggal', 2, false, true, 2, 0, false, NULL, true, true, 6, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Ibadah Keagamaan', 'religious', 'Cuti ibadah sesuai kebutuhan', 0, false, true, NULL, 7, false, NULL, true, true, 7, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Tanpa Gaji', 'unpaid', 'Cuti tanpa gaji', 0, false, true, NULL, 7, false, NULL, true, true, 8, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Seed permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-leave', 'view', 'View leave types, balances, requests', 23),
  (gen_random_uuid()::text, 'hr-leave', 'create', 'Create leave types, generate balances', 23),
  (gen_random_uuid()::text, 'hr-leave', 'edit', 'Edit leave types, adjust balances', 23),
  (gen_random_uuid()::text, 'hr-leave', 'delete', 'Delete custom leave types', 23),
  (gen_random_uuid()::text, 'hr-leave', 'approve', 'Approve/reject leave requests (HR level)', 23)
ON CONFLICT (module, action) DO NOTHING;
