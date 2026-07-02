-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Religion" AS ENUM ('islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmploymentType" AS ENUM ('permanent', 'contract', 'probation', 'intern');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: departments
CREATE TABLE IF NOT EXISTS "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "headId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_key" ON "departments"("name");
CREATE INDEX IF NOT EXISTS "departments_parentId_idx" ON "departments"("parentId");
CREATE INDEX IF NOT EXISTS "departments_headId_idx" ON "departments"("headId");

-- CreateTable: positions
CREATE TABLE IF NOT EXISTS "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "positions_name_key" ON "positions"("name");
CREATE INDEX IF NOT EXISTS "positions_departmentId_idx" ON "positions"("departmentId");

-- CreateTable: employee_documents
CREATE TABLE IF NOT EXISTS "employee_documents" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employee_documents_profileId_idx" ON "employee_documents"("profileId");
CREATE INDEX IF NOT EXISTS "employee_documents_uploadedBy_idx" ON "employee_documents"("uploadedBy");

-- CreateTable: employment_histories
CREATE TABLE IF NOT EXISTS "employment_histories" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employment_histories_profileId_idx" ON "employment_histories"("profileId");
CREATE INDEX IF NOT EXISTS "employment_histories_effectiveDate_idx" ON "employment_histories"("effectiveDate");
CREATE INDEX IF NOT EXISTS "employment_histories_createdBy_idx" ON "employment_histories"("createdBy");

-- AlterTable: profiles — add new columns
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "npwp" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bpjsKesehatan" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bpjsKetenagakerjaan" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "religion" "Religion";
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bloodType" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "resignDate" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "employmentType" "EmploymentType";
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "contractStartDate" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "contractEndDate" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "positionId" TEXT;

CREATE INDEX IF NOT EXISTS "profiles_departmentId_idx" ON "profiles"("departmentId");
CREATE INDEX IF NOT EXISTS "profiles_positionId_idx" ON "profiles"("positionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_headId_fkey" FOREIGN KEY ("headId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "positions" ADD CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr', 'create', 'Create employees', 20),
  (gen_random_uuid()::text, 'hr', 'edit', 'Edit employees', 20),
  (gen_random_uuid()::text, 'hr', 'delete', 'Delete employees', 20),
  (gen_random_uuid()::text, 'hr', 'export', 'Export employee data', 20),
  (gen_random_uuid()::text, 'hr-departments', 'view', 'View departments', 21),
  (gen_random_uuid()::text, 'hr-departments', 'create', 'Create departments', 21),
  (gen_random_uuid()::text, 'hr-departments', 'edit', 'Edit departments', 21),
  (gen_random_uuid()::text, 'hr-departments', 'delete', 'Delete departments', 21),
  (gen_random_uuid()::text, 'hr-positions', 'view', 'View positions', 22),
  (gen_random_uuid()::text, 'hr-positions', 'create', 'Create positions', 22),
  (gen_random_uuid()::text, 'hr-positions', 'edit', 'Edit positions', 22),
  (gen_random_uuid()::text, 'hr-positions', 'delete', 'Delete positions', 22)
ON CONFLICT (module, action) DO NOTHING;
