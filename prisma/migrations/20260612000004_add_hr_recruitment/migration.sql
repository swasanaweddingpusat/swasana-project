-- CreateEnums
DO $$ BEGIN CREATE TYPE "PositionType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "JobStatus" AS ENUM ('OPEN','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApplicantStatus" AS ENUM ('NEW','REVIEWED','INTERVIEWED','OFFERED','HIRED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InterviewType" AS ENUM ('PHONE_SCREENING','TECHNICAL','HR_ROUND','FINAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OfferStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS','COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable job_postings
CREATE TABLE IF NOT EXISTS "job_postings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "salaryRangeMin" DECIMAL(15,2),
    "salaryRangeMax" DECIMAL(15,2),
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "applicationDeadline" TIMESTAMP(3),
    "maxApplicants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable applicants
CREATE TABLE IF NOT EXISTS "applicants" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "position" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable interviews
CREATE TABLE IF NOT EXISTS "interviews" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "interviewerId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "interviewType" "InterviewType" NOT NULL,
    "interviewLocation" TEXT,
    "interviewDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "interviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable job_offers
CREATE TABLE IF NOT EXISTS "job_offers" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "salary" DECIMAL(15,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable onboarding_templates
CREATE TABLE IF NOT EXISTS "onboarding_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable onboarding_template_items
CREATE TABLE IF NOT EXISTS "onboarding_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "onboarding_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable employee_onboardings
CREATE TABLE IF NOT EXISTS "employee_onboardings" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "templateId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
DO $$ BEGIN
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_template_items" ADD CONSTRAINT "onboarding_template_items_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "onboarding_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "applicants_jobPostingId_idx" ON "applicants"("jobPostingId");
CREATE INDEX IF NOT EXISTS "interviews_applicantId_idx" ON "interviews"("applicantId");
CREATE INDEX IF NOT EXISTS "employee_onboardings_profileId_idx" ON "employee_onboardings"("profileId");
