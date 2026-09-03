-- Prevent the same person from submitting multiple applications to the same
-- job posting. Enables the P2002 duplicate-detection already handled by
-- actions/candidate.ts (addCandidate) and now also by app/api/apply/[token]/route.ts.
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_jobPostingId_email_key" ON "candidates"("jobPostingId", "email");
