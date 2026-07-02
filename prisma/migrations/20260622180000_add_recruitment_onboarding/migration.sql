-- ─── Recruitment & Onboarding Migration ──────────────────────────────────────

-- CreateEnum: JobPostingStatus
DO $$ BEGIN
  CREATE TYPE "JobPostingStatus" AS ENUM ('draft', 'open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: CandidateStage
DO $$ BEGIN
  CREATE TYPE "CandidateStage" AS ENUM ('applied', 'screening', 'interview', 'assessment', 'offering', 'hired', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: OnboardingAssignTo
DO $$ BEGIN
  CREATE TYPE "OnboardingAssignTo" AS ENUM ('employee', 'hr', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: OnboardingStatus
DO $$ BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM ('in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- CreateTable: job_postings
CREATE TABLE IF NOT EXISTS "job_postings" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "departmentId"   TEXT,
  "positionId"     TEXT,
  "description"    TEXT,
  "requirements"   TEXT,
  "employmentType" "EmploymentType",
  "location"       TEXT,
  "salaryRangeMin" DECIMAL(15,2),
  "salaryRangeMax" DECIMAL(15,2),
  "status"         "JobPostingStatus" NOT NULL DEFAULT 'draft',
  "openDate"       TIMESTAMP(3),
  "closeDate"      TIMESTAMP(3),
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: candidates
CREATE TABLE IF NOT EXISTS "candidates" (
  "id"              TEXT NOT NULL,
  "jobPostingId"    TEXT NOT NULL,
  "fullName"        TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "phoneNumber"     TEXT,
  "resumeUrl"       TEXT,
  "coverLetterUrl"  TEXT,
  "stage"           "CandidateStage" NOT NULL DEFAULT 'applied',
  "rating"          INTEGER,
  "notes"           TEXT,
  "rejectionReason" TEXT,
  "hiredAt"         TIMESTAMP(3),
  "hiredProfileId"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: candidate_notes
CREATE TABLE IF NOT EXISTS "candidate_notes" (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "createdBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: onboarding_templates
CREATE TABLE IF NOT EXISTS "onboarding_templates" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: onboarding_template_tasks
CREATE TABLE IF NOT EXISTS "onboarding_template_tasks" (
  "id"          TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "dueInDays"   INTEGER NOT NULL DEFAULT 1,
  "assignTo"    "OnboardingAssignTo" NOT NULL DEFAULT 'employee',
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "onboarding_template_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: onboarding_assignments
CREATE TABLE IF NOT EXISTS "onboarding_assignments" (
  "id"          TEXT NOT NULL,
  "profileId"   TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "status"      "OnboardingStatus" NOT NULL DEFAULT 'in_progress',
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: onboarding_tasks
CREATE TABLE IF NOT EXISTS "onboarding_tasks" (
  "id"             TEXT NOT NULL,
  "assignmentId"   TEXT NOT NULL,
  "templateTaskId" TEXT,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "dueDate"        TIMESTAMP(3),
  "assignTo"       "OnboardingAssignTo" NOT NULL DEFAULT 'employee',
  "isCompleted"    BOOLEAN NOT NULL DEFAULT false,
  "completedAt"    TIMESTAMP(3),
  "completedBy"    TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- ─── Unique Constraints ───────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_name_key" UNIQUE ("name");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_assignments" ADD CONSTRAINT "onboarding_assignments_profileId_templateId_key" UNIQUE ("profileId", "templateId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "job_postings_departmentId_idx" ON "job_postings"("departmentId");
CREATE INDEX IF NOT EXISTS "job_postings_status_idx" ON "job_postings"("status");

CREATE INDEX IF NOT EXISTS "candidates_jobPostingId_idx" ON "candidates"("jobPostingId");
CREATE INDEX IF NOT EXISTS "candidates_stage_idx" ON "candidates"("stage");
CREATE INDEX IF NOT EXISTS "candidates_hiredProfileId_idx" ON "candidates"("hiredProfileId");

CREATE INDEX IF NOT EXISTS "candidate_notes_candidateId_idx" ON "candidate_notes"("candidateId");

CREATE INDEX IF NOT EXISTS "onboarding_template_tasks_templateId_idx" ON "onboarding_template_tasks"("templateId");

CREATE INDEX IF NOT EXISTS "onboarding_assignments_profileId_idx" ON "onboarding_assignments"("profileId");
CREATE INDEX IF NOT EXISTS "onboarding_assignments_status_idx" ON "onboarding_assignments"("status");

CREATE INDEX IF NOT EXISTS "onboarding_tasks_assignmentId_idx" ON "onboarding_tasks"("assignmentId");

-- ─── Foreign Key Constraints ─────────────────────────────────────────────────

-- job_postings → departments
DO $$ BEGIN
  ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- job_postings → positions
DO $$ BEGIN
  ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- job_postings → profiles (creator)
DO $$ BEGIN
  ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- candidates → job_postings
DO $$ BEGIN
  ALTER TABLE "candidates" ADD CONSTRAINT "candidates_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- candidates → profiles (hired)
DO $$ BEGIN
  ALTER TABLE "candidates" ADD CONSTRAINT "candidates_hiredProfileId_fkey"
    FOREIGN KEY ("hiredProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- candidate_notes → candidates
DO $$ BEGIN
  ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- candidate_notes → profiles (creator)
DO $$ BEGIN
  ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- onboarding_template_tasks → onboarding_templates
DO $$ BEGIN
  ALTER TABLE "onboarding_template_tasks" ADD CONSTRAINT "onboarding_template_tasks_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- onboarding_assignments → profiles
DO $$ BEGIN
  ALTER TABLE "onboarding_assignments" ADD CONSTRAINT "onboarding_assignments_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- onboarding_assignments → onboarding_templates
DO $$ BEGIN
  ALTER TABLE "onboarding_assignments" ADD CONSTRAINT "onboarding_assignments_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- onboarding_tasks → onboarding_assignments
DO $$ BEGIN
  ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "onboarding_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- onboarding_tasks → onboarding_template_tasks
DO $$ BEGIN
  ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_templateTaskId_fkey"
    FOREIGN KEY ("templateTaskId") REFERENCES "onboarding_template_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- onboarding_tasks → profiles (completer)
DO $$ BEGIN
  ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_completedBy_fkey"
    FOREIGN KEY ("completedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Seed: hr-recruitment permissions ─────────────────────────────────────────

INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-recruitment', 'view',   'View job postings, candidates, onboarding', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'create', 'Create postings, add candidates, templates', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'edit',   'Edit postings, move candidates, manage pipeline', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'delete', 'Delete postings, candidates, templates', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'hire',   'Hire candidates (creates employee account)', 25)
ON CONFLICT (module, action) DO NOTHING;
