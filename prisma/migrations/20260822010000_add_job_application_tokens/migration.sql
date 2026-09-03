-- ─── Job Application Token (one-time form-session nonce) ────────────────────
-- Separate from job_postings.publicToken (long-lived, shared by many
-- applicants). This token is minted fresh on every GET of the public apply
-- form and claimed exactly once on submit, to reject duplicate/replayed
-- submissions while keeping the public link itself reusable.

-- CreateTable: job_application_tokens
CREATE TABLE IF NOT EXISTS "job_application_tokens" (
  "id" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_application_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "job_application_tokens_token_key" ON "job_application_tokens"("token");
CREATE INDEX IF NOT EXISTS "job_application_tokens_jobPostingId_idx" ON "job_application_tokens"("jobPostingId");
CREATE INDEX IF NOT EXISTS "job_application_tokens_token_idx" ON "job_application_tokens"("token");

-- AddForeignKey (drop-before-add for idempotency)
ALTER TABLE "job_application_tokens" DROP CONSTRAINT IF EXISTS "job_application_tokens_jobPostingId_fkey";
ALTER TABLE "job_application_tokens" ADD CONSTRAINT "job_application_tokens_jobPostingId_fkey"
  FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
