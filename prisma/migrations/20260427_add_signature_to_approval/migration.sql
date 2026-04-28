-- AlterTable
ALTER TABLE "approval_record_steps" ADD COLUMN     "signature" TEXT;

-- AlterTable
ALTER TABLE "approval_records" ADD COLUMN     "signature" TEXT;
