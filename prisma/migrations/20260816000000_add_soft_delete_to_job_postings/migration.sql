-- Add soft delete support to job_postings
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
