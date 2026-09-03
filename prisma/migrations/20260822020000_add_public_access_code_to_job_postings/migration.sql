-- ─── JobPosting.publicAccessCode ─────────────────────────────────────────────
-- Shared, human-visible 6-character access code gating the public application
-- form (/apply/[token]). Not @unique — like CandidateInvite.accessCode, only
-- needs to be a secret per-record, not globally unique.

ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "publicAccessCode" TEXT;
