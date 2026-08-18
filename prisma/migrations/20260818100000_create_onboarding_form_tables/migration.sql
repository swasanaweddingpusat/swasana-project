-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnboardingFormLinkStatus" AS ENUM ('Active', 'Revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: onboarding_form_links (simplified — no job fields)
CREATE TABLE IF NOT EXISTS "onboarding_form_links" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "status" "OnboardingFormLinkStatus" NOT NULL DEFAULT 'Active',
    "viewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_form_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable: onboarding_form_submissions (includes job fields)
CREATE TABLE IF NOT EXISTS "onboarding_form_submissions" (
    "id" TEXT NOT NULL,
    "formLinkId" TEXT NOT NULL,
    "divisi" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickName" TEXT NOT NULL,
    "placeOfBirth" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "maritalStatus" TEXT NOT NULL,
    "ktpAddress" TEXT NOT NULL,
    "currentAddress" TEXT NOT NULL,
    "motherName" TEXT NOT NULL,
    "numberOfChildren" INTEGER NOT NULL DEFAULT 0,
    "lastEducation" TEXT NOT NULL,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactRel" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "ktpFileUrl" TEXT,
    "kkFileUrl" TEXT,
    "photoUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_form_links_token_key" ON "onboarding_form_links"("token");
CREATE INDEX IF NOT EXISTS "onboarding_form_links_token_idx" ON "onboarding_form_links"("token");

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_form_submissions_formLinkId_key" ON "onboarding_form_submissions"("formLinkId");
CREATE INDEX IF NOT EXISTS "onboarding_form_submissions_formLinkId_idx" ON "onboarding_form_submissions"("formLinkId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "onboarding_form_links" ADD CONSTRAINT "onboarding_form_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_form_submissions" ADD CONSTRAINT "onboarding_form_submissions_formLinkId_fkey" FOREIGN KEY ("formLinkId") REFERENCES "onboarding_form_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_form_submissions" ADD CONSTRAINT "onboarding_form_submissions_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
