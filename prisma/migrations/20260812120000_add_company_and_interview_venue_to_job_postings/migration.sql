-- AlterTable job_postings: add company name + interview link/venue
ALTER TABLE "job_postings"
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "interviewLink" TEXT,
  ADD COLUMN IF NOT EXISTS "interviewVenueId" TEXT;

-- AddForeignKey (drop-before-add for idempotency)
ALTER TABLE "job_postings" DROP CONSTRAINT IF EXISTS "job_postings_interviewVenueId_fkey";
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_interviewVenueId_fkey"
  FOREIGN KEY ("interviewVenueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_postings_interviewVenueId_idx" ON "job_postings"("interviewVenueId");
