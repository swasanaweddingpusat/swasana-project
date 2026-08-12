-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentFormLinkStatus" AS ENUM ('Active', 'Revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "recruitment_form_links" (
    "id" TEXT NOT NULL,
    "recruitmentRequestId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "status" "RecruitmentFormLinkStatus" NOT NULL DEFAULT 'Active',
    "viewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_form_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "candidate_submissions" (
    "id" TEXT NOT NULL,
    "formLinkId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "address" TEXT,
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3),
    "lastEducation" TEXT,
    "major" TEXT,
    "workExperienceYears" INTEGER,
    "workHistory" TEXT,
    "cvUrl" TEXT,
    "photoUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_form_links_recruitmentRequestId_key" ON "recruitment_form_links"("recruitmentRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_form_links_token_key" ON "recruitment_form_links"("token");
CREATE INDEX IF NOT EXISTS "recruitment_form_links_token_idx" ON "recruitment_form_links"("token");
CREATE INDEX IF NOT EXISTS "candidate_submissions_formLinkId_idx" ON "candidate_submissions"("formLinkId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "recruitment_form_links" ADD CONSTRAINT "recruitment_form_links_recruitmentRequestId_fkey"
    FOREIGN KEY ("recruitmentRequestId") REFERENCES "recruitment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_submissions" ADD CONSTRAINT "candidate_submissions_formLinkId_fkey"
    FOREIGN KEY ("formLinkId") REFERENCES "recruitment_form_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
