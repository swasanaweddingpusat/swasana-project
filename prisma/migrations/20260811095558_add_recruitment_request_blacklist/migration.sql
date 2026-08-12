-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecruitmentRequestPriority" AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "recruitment_requests" (
    "id" TEXT NOT NULL,
    "fpkNumber" TEXT NOT NULL,
    "isWalkinInterview" BOOLEAN NOT NULL DEFAULT false,
    "company" TEXT,
    "documentDate" TIMESTAMP(3),
    "departmentId" TEXT,
    "positionId" TEXT,
    "level" TEXT,
    "salary" DECIMAL(15,2),
    "quota" INTEGER NOT NULL DEFAULT 1,
    "workLocation" TEXT,
    "interviewLocation" TEXT,
    "trainingCompanion" TEXT,
    "startDate" TIMESTAMP(3),
    "minEducation" TEXT,
    "minExperience" TEXT,
    "otherQualifications" TEXT,
    "jobDescriptions" TEXT[],
    "additionalNotes" TEXT[],
    "approver1Id" TEXT,
    "approver2Id" TEXT,
    "requestedById" TEXT,
    "status" "RecruitmentRequestStatus" NOT NULL DEFAULT 'pending',
    "priority" "RecruitmentRequestPriority" NOT NULL DEFAULT 'medium',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "blacklist_entries" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "reason" TEXT NOT NULL,
    "blacklistedById" TEXT,
    "blacklistedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blacklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_requests_fpkNumber_key" ON "recruitment_requests"("fpkNumber");
CREATE INDEX IF NOT EXISTS "recruitment_requests_status_idx" ON "recruitment_requests"("status");
CREATE INDEX IF NOT EXISTS "recruitment_requests_departmentId_idx" ON "recruitment_requests"("departmentId");
CREATE INDEX IF NOT EXISTS "recruitment_requests_requestedById_idx" ON "recruitment_requests"("requestedById");
CREATE INDEX IF NOT EXISTS "blacklist_entries_email_idx" ON "blacklist_entries"("email");

-- AddForeignKey
ALTER TABLE "recruitment_requests" ADD CONSTRAINT "recruitment_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_requests" ADD CONSTRAINT "recruitment_requests_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_requests" ADD CONSTRAINT "recruitment_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_requests" ADD CONSTRAINT "recruitment_requests_approver1Id_fkey" FOREIGN KEY ("approver1Id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_requests" ADD CONSTRAINT "recruitment_requests_approver2Id_fkey" FOREIGN KEY ("approver2Id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_blacklistedById_fkey" FOREIGN KEY ("blacklistedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
