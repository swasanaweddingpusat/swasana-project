/*
  Warnings:

  - You are about to drop the `employee_grievances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employee_insurances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employee_loans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `health_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `labor_disputes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payroll_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reimbursements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tax_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "employee_grievances" DROP CONSTRAINT "employee_grievances_profileId_fkey";

-- DropForeignKey
ALTER TABLE "employee_insurances" DROP CONSTRAINT "employee_insurances_profileId_fkey";

-- DropForeignKey
ALTER TABLE "employee_loans" DROP CONSTRAINT "employee_loans_profileId_fkey";

-- DropForeignKey
ALTER TABLE "health_records" DROP CONSTRAINT "health_records_profileId_fkey";

-- DropForeignKey
ALTER TABLE "labor_disputes" DROP CONSTRAINT "labor_disputes_profileId_fkey";

-- DropForeignKey
ALTER TABLE "payroll_records" DROP CONSTRAINT "payroll_records_profileId_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_profileId_fkey";

-- DropIndex
DROP INDEX "complimentaries_name_key";

-- DropIndex
DROP INDEX "leads_venueSecondaryId_eventDate_isDateLocked_idx";

-- AlterTable
ALTER TABLE "attendance_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendances" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "credit_balances" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "event_evaluations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_segments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ledgers" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vendor_evaluations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wedding_indicators" ALTER COLUMN "questionnaireData" SET DEFAULT '{}'::jsonb,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "employee_grievances";

-- DropTable
DROP TABLE "employee_insurances";

-- DropTable
DROP TABLE "employee_loans";

-- DropTable
DROP TABLE "health_records";

-- DropTable
DROP TABLE "labor_disputes";

-- DropTable
DROP TABLE "payroll_records";

-- DropTable
DROP TABLE "reimbursements";

-- DropTable
DROP TABLE "tax_configs";

-- DropEnum
DROP TYPE "DisputeStatus";

-- DropEnum
DROP TYPE "DisputeType";

-- DropEnum
DROP TYPE "HealthStatus";

-- DropEnum
DROP TYPE "InsuranceStatus";

-- DropEnum
DROP TYPE "LoanStatus";

-- DropEnum
DROP TYPE "PayrollStatus";

-- DropEnum
DROP TYPE "ReimbursementStatus";

-- RenameIndex
ALTER INDEX "employee_work_assignments_profileId_workLocationId_workShiftId_" RENAME TO "employee_work_assignments_profileId_workLocationId_workShif_key";
