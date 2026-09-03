-- ─── Candidate Invite (personal access-code link) + file metadata ───────────
-- Adds a per-candidate one-time invite link (token + 6-digit access code,
-- mirrors client_agreements) and stores original filename/storage key/mime
-- type for photo and KTP photo uploads (candidates + candidate invite flow).

-- CreateEnum: CandidateInviteStatus (idempotent)
DO $$ BEGIN
  CREATE TYPE "CandidateInviteStatus" AS ENUM ('Pending', 'Viewed', 'Completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable candidates: file metadata columns
ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "photoOriginalName" TEXT,
  ADD COLUMN IF NOT EXISTS "photoStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "photoMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "ktpPhotoOriginalName" TEXT,
  ADD COLUMN IF NOT EXISTS "ktpPhotoStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "ktpPhotoMimeType" TEXT;

-- CreateTable: candidate_invites
CREATE TABLE IF NOT EXISTS "candidate_invites" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "accessCode" TEXT NOT NULL,
  "status" "CandidateInviteStatus" NOT NULL DEFAULT 'Pending',
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidate_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_invites_candidateId_key" ON "candidate_invites"("candidateId");
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_invites_token_key" ON "candidate_invites"("token");
CREATE INDEX IF NOT EXISTS "candidate_invites_token_idx" ON "candidate_invites"("token");

-- AddForeignKey (drop-before-add for idempotency)
ALTER TABLE "candidate_invites" DROP CONSTRAINT IF EXISTS "candidate_invites_candidateId_fkey";
ALTER TABLE "candidate_invites" ADD CONSTRAINT "candidate_invites_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
