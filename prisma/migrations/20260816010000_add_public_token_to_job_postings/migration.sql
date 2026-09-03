-- Add public application form token to job_postings
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "job_postings_publicToken_key" ON "job_postings"("publicToken");
