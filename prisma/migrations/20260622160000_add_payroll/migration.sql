-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalaryComponentType" AS ENUM ('earning', 'deduction');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalaryComponentCategory" AS ENUM ('basic', 'allowance', 'deduction', 'benefit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Pph21Method" AS ENUM ('ter', 'progressive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PtkpStatus" AS ENUM ('TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PayrollPeriodStatus" AS ENUM ('draft', 'processing', 'finalized', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PayslipStatus" AS ENUM ('draft', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: salary_components
CREATE TABLE IF NOT EXISTS "salary_components" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "type"         "SalaryComponentType" NOT NULL,
  "category"     "SalaryComponentCategory" NOT NULL,
  "isFixed"      BOOLEAN NOT NULL DEFAULT true,
  "isTaxable"    BOOLEAN NOT NULL DEFAULT true,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "isSystemType" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_name_key" UNIQUE ("name");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_code_key" UNIQUE ("code");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: employee_salaries
CREATE TABLE IF NOT EXISTS "employee_salaries" (
  "id"                TEXT NOT NULL,
  "profileId"         TEXT NOT NULL,
  "salaryComponentId" TEXT NOT NULL,
  "amount"            DECIMAL(15, 2) NOT NULL,
  "effectiveDate"     TIMESTAMP(3) NOT NULL,
  "endDate"           TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_profileId_salaryComponentId_effectiveDate_key"
    UNIQUE ("profileId", "salaryComponentId", "effectiveDate");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "employee_salaries_profileId_idx" ON "employee_salaries"("profileId");
CREATE INDEX IF NOT EXISTS "employee_salaries_salaryComponentId_idx" ON "employee_salaries"("salaryComponentId");

-- CreateTable: payroll_settings
CREATE TABLE IF NOT EXISTS "payroll_settings" (
  "id"                       TEXT NOT NULL,
  "pph21Method"              "Pph21Method" NOT NULL DEFAULT 'ter',
  "bpjsKesCompanyRate"       DECIMAL(5, 2) NOT NULL DEFAULT 4.0,
  "bpjsKesEmployeeRate"      DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  "bpjsKesMaxSalary"         DECIMAL(15, 2) NOT NULL DEFAULT 12000000,
  "jhtCompanyRate"           DECIMAL(5, 2) NOT NULL DEFAULT 3.7,
  "jhtEmployeeRate"          DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
  "jkkRate"                  DECIMAL(5, 2) NOT NULL DEFAULT 0.24,
  "jkmRate"                  DECIMAL(5, 2) NOT NULL DEFAULT 0.3,
  "jpCompanyRate"            DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
  "jpEmployeeRate"           DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  "jpMaxSalary"              DECIMAL(15, 2) NOT NULL DEFAULT 10042300,
  "absenceDeductionPerDay"   DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "lateDeductionPerIncident" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_periods
CREATE TABLE IF NOT EXISTS "payroll_periods" (
  "id"               TEXT NOT NULL,
  "month"            INTEGER NOT NULL,
  "year"             INTEGER NOT NULL,
  "status"           "PayrollPeriodStatus" NOT NULL DEFAULT 'draft',
  "totalEmployees"   INTEGER NOT NULL DEFAULT 0,
  "totalGrossAmount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "totalNetAmount"   DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "generatedBy"      TEXT,
  "generatedAt"      TIMESTAMP(3),
  "finalizedBy"      TEXT,
  "finalizedAt"      TIMESTAMP(3),
  "paidAt"           TIMESTAMP(3),
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_month_year_key" UNIQUE ("month", "year");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: payslips
CREATE TABLE IF NOT EXISTS "payslips" (
  "id"                TEXT NOT NULL,
  "payrollPeriodId"   TEXT NOT NULL,
  "profileId"         TEXT NOT NULL,
  "employeeName"      TEXT NOT NULL,
  "employeeNumber"    INTEGER NOT NULL,
  "departmentName"    TEXT,
  "positionName"      TEXT,
  "bankName"          TEXT,
  "bankAccountNumber" TEXT,
  "bankAccountHolder" TEXT,
  "npwp"              TEXT,
  "ptkpStatus"        "PtkpStatus",
  "totalEarnings"     DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "totalDeductions"   DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "netSalary"         DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "pph21Method"       "Pph21Method",
  "pph21Amount"       DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "bpjsKesCompany"    DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "bpjsKesEmployee"   DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "jhtCompany"        DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "jhtEmployee"       DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "jkkAmount"         DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "jkmAmount"         DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "jpCompany"         DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "jpEmployee"        DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "totalWorkDays"     INTEGER NOT NULL DEFAULT 0,
  "totalPresent"      INTEGER NOT NULL DEFAULT 0,
  "totalAbsent"       INTEGER NOT NULL DEFAULT 0,
  "totalLate"         INTEGER NOT NULL DEFAULT 0,
  "totalLeave"        INTEGER NOT NULL DEFAULT 0,
  "absenceDeduction"  DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "lateDeduction"     DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "status"            "PayslipStatus" NOT NULL DEFAULT 'draft',
  "pdfUrl"            TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollPeriodId_profileId_key"
    UNIQUE ("payrollPeriodId", "profileId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "payslips_payrollPeriodId_idx" ON "payslips"("payrollPeriodId");
CREATE INDEX IF NOT EXISTS "payslips_profileId_idx" ON "payslips"("profileId");

-- CreateTable: payslip_items
CREATE TABLE IF NOT EXISTS "payslip_items" (
  "id"                TEXT NOT NULL,
  "payslipId"         TEXT NOT NULL,
  "salaryComponentId" TEXT,
  "name"              TEXT NOT NULL,
  "type"              "SalaryComponentType" NOT NULL,
  "amount"            DECIMAL(15, 2) NOT NULL,
  "sortOrder"         INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "payslip_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payslip_items_payslipId_idx" ON "payslip_items"("payslipId");

-- AlterTable: profiles — add ptkpStatus column
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "ptkpStatus" "PtkpStatus";

-- AddForeignKey: employee_salaries -> profiles
DO $$ BEGIN
  ALTER TABLE "employee_salaries"
    ADD CONSTRAINT "employee_salaries_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: employee_salaries -> salary_components
DO $$ BEGIN
  ALTER TABLE "employee_salaries"
    ADD CONSTRAINT "employee_salaries_salaryComponentId_fkey"
    FOREIGN KEY ("salaryComponentId") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: payroll_periods -> profiles (generator)
DO $$ BEGIN
  ALTER TABLE "payroll_periods"
    ADD CONSTRAINT "payroll_periods_generatedBy_fkey"
    FOREIGN KEY ("generatedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: payroll_periods -> profiles (finalizer)
DO $$ BEGIN
  ALTER TABLE "payroll_periods"
    ADD CONSTRAINT "payroll_periods_finalizedBy_fkey"
    FOREIGN KEY ("finalizedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: payslips -> payroll_periods
DO $$ BEGIN
  ALTER TABLE "payslips"
    ADD CONSTRAINT "payslips_payrollPeriodId_fkey"
    FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: payslips -> profiles
DO $$ BEGIN
  ALTER TABLE "payslips"
    ADD CONSTRAINT "payslips_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: payslip_items -> payslips
DO $$ BEGIN
  ALTER TABLE "payslip_items"
    ADD CONSTRAINT "payslip_items_payslipId_fkey"
    FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: payslip_items -> salary_components
DO $$ BEGIN
  ALTER TABLE "payslip_items"
    ADD CONSTRAINT "payslip_items_salaryComponentId_fkey"
    FOREIGN KEY ("salaryComponentId") REFERENCES "salary_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed: preset salary components
INSERT INTO "salary_components" (id, name, code, type, category, "isFixed", "isTaxable", "isActive", "isSystemType", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Gaji Pokok', 'basic_salary', 'earning', 'basic', true, true, true, true, 1, NOW(), NOW()),
  (gen_random_uuid()::text, 'Tunjangan Transport', 'transport_allowance', 'earning', 'allowance', true, true, true, false, 2, NOW(), NOW()),
  (gen_random_uuid()::text, 'Tunjangan Makan', 'meal_allowance', 'earning', 'allowance', true, true, true, false, 3, NOW(), NOW()),
  (gen_random_uuid()::text, 'Tunjangan Jabatan', 'position_allowance', 'earning', 'allowance', true, true, true, false, 4, NOW(), NOW()),
  (gen_random_uuid()::text, 'Tunjangan Komunikasi', 'communication_allowance', 'earning', 'allowance', true, true, true, false, 5, NOW(), NOW()),
  (gen_random_uuid()::text, 'Uang Lembur', 'overtime_pay', 'earning', 'allowance', false, true, true, false, 6, NOW(), NOW()),
  (gen_random_uuid()::text, 'Bonus', 'bonus', 'earning', 'allowance', false, true, true, false, 7, NOW(), NOW()),
  (gen_random_uuid()::text, 'Potongan Pinjaman', 'loan_deduction', 'deduction', 'deduction', false, false, true, false, 8, NOW(), NOW()),
  (gen_random_uuid()::text, 'Potongan Lain-lain', 'other_deduction', 'deduction', 'deduction', false, false, true, false, 9, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Seed: default PayrollSettings row
INSERT INTO "payroll_settings" (id, "pph21Method", "bpjsKesCompanyRate", "bpjsKesEmployeeRate", "bpjsKesMaxSalary", "jhtCompanyRate", "jhtEmployeeRate", "jkkRate", "jkmRate", "jpCompanyRate", "jpEmployeeRate", "jpMaxSalary", "absenceDeductionPerDay", "lateDeductionPerIncident", "updatedAt")
VALUES (gen_random_uuid()::text, 'ter', 4.0, 1.0, 12000000, 3.7, 2.0, 0.24, 0.3, 2.0, 1.0, 10042300, 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Seed: hr-payroll permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-payroll', 'view', 'View payroll periods, settings, components', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'create', 'Generate payroll, create components', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'edit', 'Edit components, settings, salaries', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'delete', 'Delete draft periods, components', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'finalize', 'Finalize and mark payroll as paid', 24)
ON CONFLICT (module, action) DO NOTHING;
