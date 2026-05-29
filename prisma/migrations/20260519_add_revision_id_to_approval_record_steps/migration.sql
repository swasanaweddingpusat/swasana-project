-- AlterTable
ALTER TABLE "approval_record_steps" ADD COLUMN IF NOT EXISTS "revisionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_record_steps_revisionId_idx" ON "approval_record_steps"("revisionId");

-- AddForeignKey
ALTER TABLE "approval_record_steps" DROP CONSTRAINT IF EXISTS "approval_record_steps_revisionId_fkey";
ALTER TABLE "approval_record_steps" ADD CONSTRAINT "approval_record_steps_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "booking_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
