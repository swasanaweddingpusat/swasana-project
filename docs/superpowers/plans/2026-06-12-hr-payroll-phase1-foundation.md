# HR & Payroll — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the complete data and navigation foundation for the HR & Payroll module — 8 Prisma migrations, route-meta entries, sidebar activation, and 13 stub pages — so every subsequent phase can build on a stable schema.

**Architecture:** All 20+ Prisma models are added via 8 idempotent migration files grouped by sub-module. The `Profile` model gains 14 new relations. Route-meta and sidebar are updated so navigation works. Each sub-module gets a stub `page.tsx` that guards with `requirePagePermission("hr")` and renders a "Segera Hadir" placeholder.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + Neon HTTP adapter, TypeScript strict, Tailwind v4, Solar BoldDuotone icons

---

## File Map

### Modified files
- `prisma/schema.prisma` — add 21 enums, 20 models, 14 Profile relations
- `lib/route-meta.ts` — add 14 route-meta entries
- `app/(private)/dashboard/_components/sidebar/sidebar-config.ts` — remove `hidden: true` from HR entry

### Created files (migrations)
- `prisma/migrations/20260612000001_add_hr_attendance/migration.sql`
- `prisma/migrations/20260612000002_add_hr_leave/migration.sql`
- `prisma/migrations/20260612000003_add_hr_payroll/migration.sql`
- `prisma/migrations/20260612000004_add_hr_recruitment/migration.sql`
- `prisma/migrations/20260612000005_add_hr_development/migration.sql`
- `prisma/migrations/20260612000006_add_hr_performance/migration.sql`
- `prisma/migrations/20260612000007_add_hr_health/migration.sql`
- `prisma/migrations/20260612000008_add_hr_industrial/migration.sql`

### Created files (stub pages)
- `app/(private)/dashboard/hr/database-karyawan/page.tsx`
- `app/(private)/dashboard/hr/manajemen-kehadiran/page.tsx`
- `app/(private)/dashboard/hr/absensi/page.tsx`
- `app/(private)/dashboard/hr/sistem-cuti/page.tsx`
- `app/(private)/dashboard/hr/penggajian-perpajakan/page.tsx`
- `app/(private)/dashboard/hr/slip-gaji/page.tsx`
- `app/(private)/dashboard/hr/rekrutmen-onboarding/page.tsx`
- `app/(private)/dashboard/hr/pengembangan-sdm/page.tsx`
- `app/(private)/dashboard/hr/manajemen-kinerja/page.tsx`
- `app/(private)/dashboard/hr/manajemen-kesehatan/page.tsx`
- `app/(private)/dashboard/hr/reimbursement-loan/page.tsx`
- `app/(private)/dashboard/hr/hubungan-industrial/page.tsx`
- `app/(private)/dashboard/hr/analitik-laporan/page.tsx`

---

## Task 1: Migration — Attendance

**Files:**
- Create: `prisma/migrations/20260612000001_add_hr_attendance/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration directory and SQL file**

```bash
mkdir -p prisma/migrations/20260612000001_add_hr_attendance
```

Create `prisma/migrations/20260612000001_add_hr_attendance/migration.sql`:

```sql
-- CreateEnum GeofenceStatus
DO $$ BEGIN
  CREATE TYPE "GeofenceStatus" AS ENUM ('IN_RANGE', 'OUT_OF_RANGE', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable attendances
CREATE TABLE IF NOT EXISTS "attendances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "photoCheckInUrl" TEXT,
    "photoCheckOutUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "geofenceStatus" "GeofenceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_profileId_idx" ON "attendances"("profileId");
CREATE INDEX IF NOT EXISTS "attendances_clockIn_idx" ON "attendances"("clockIn");
```

- [ ] **Step 2: Add Attendance model to `prisma/schema.prisma`**

After the last `@@map("profiles")` closing brace for Profile (around line 156), find the line `@@map("profiles")` and look at the Profile model. You need to:

1. Add `attendances Attendance[]` to the **Profile** model's relations section (after `procurementAnnouncements` relation, before `@@index([roleId])`):

```prisma
  attendances                Attendance[]
```

2. At the end of `prisma/schema.prisma`, add:

```prisma
// ─── HR & Payroll ─────────────────────────────────────────────────────────────

enum GeofenceStatus {
  IN_RANGE
  OUT_OF_RANGE
  UNKNOWN
}

model Attendance {
  id               String         @id @default(cuid())
  profileId        String
  clockIn          DateTime
  clockOut         DateTime?
  photoCheckInUrl  String?
  photoCheckOutUrl String?
  latitude         Float?
  longitude        Float?
  accuracy         Float?
  geofenceStatus   GeofenceStatus @default(UNKNOWN)
  isLate           Boolean        @default(false)
  notes            String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  profile          Profile        @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@index([clockIn])
  @@map("attendances")
}
```

- [ ] **Step 3: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260612000001_add_hr_attendance/migration.sql
git commit -m "feat(hr): add Attendance model and migration"
```

---

## Task 2: Migration — Leave

**Files:**
- Create: `prisma/migrations/20260612000002_add_hr_leave/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000002_add_hr_leave/migration.sql`:

```sql
-- CreateEnum LeaveType
DO $$ BEGIN
  CREATE TYPE "LeaveType" AS ENUM ('CUTI_TAHUNAN', 'SAKIT', 'IZIN', 'CUTI_BERSAMA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum LeaveStatus
DO $$ BEGIN
  CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable leave_requests
CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "daysCount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_balances
CREATE TABLE IF NOT EXISTS "leave_balances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leave_requests_profileId_idx" ON "leave_requests"("profileId");
CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_profileId_year_leaveType_key" ON "leave_balances"("profileId", "year", "leaveType");
```

- [ ] **Step 2: Add enums and models to `prisma/schema.prisma`**

Add `leaveRequests LeaveRequest[]` and `leaveBalances LeaveBalance[]` to the **Profile** model relations (after `attendances Attendance[]`).

Append to end of schema file:

```prisma
enum LeaveType {
  CUTI_TAHUNAN
  SAKIT
  IZIN
  CUTI_BERSAMA
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model LeaveRequest {
  id        String      @id @default(cuid())
  profileId String
  startDate DateTime
  endDate   DateTime
  leaveType LeaveType
  status    LeaveStatus @default(PENDING)
  daysCount Int
  reason    String
  notes     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  profile   Profile     @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("leave_requests")
}

model LeaveBalance {
  id        String    @id @default(cuid())
  profileId String
  year      Int
  leaveType LeaveType
  total     Int       @default(0)
  used      Int       @default(0)
  remaining Int       @default(0)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  profile   Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, year, leaveType])
  @@map("leave_balances")
}
```

- [ ] **Step 3: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260612000002_add_hr_leave/migration.sql
git commit -m "feat(hr): add LeaveRequest and LeaveBalance models"
```

---

## Task 3: Migration — Payroll

**Files:**
- Create: `prisma/migrations/20260612000003_add_hr_payroll/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000003_add_hr_payroll/migration.sql`:

```sql
-- CreateEnum PayrollStatus
DO $$ BEGIN
  CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'PUBLISHED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable payroll_records
CREATE TABLE IF NOT EXISTS "payroll_records" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "allowances" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(15,2) NOT NULL,
    "totalDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(15,2) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "actualDaysWorked" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable tax_configs
CREATE TABLE IF NOT EXISTS "tax_configs" (
    "id" TEXT NOT NULL,
    "ptkpCategory" TEXT NOT NULL,
    "ptkpAmount" DECIMAL(15,2) NOT NULL,
    "bpjsHealthRate" DOUBLE PRECISION NOT NULL,
    "bpjsEmployeeRate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_records_profileId_periodMonth_periodYear_key"
  ON "payroll_records"("profileId", "periodMonth", "periodYear");
```

- [ ] **Step 2: Add to `prisma/schema.prisma`**

Add `payrollRecords PayrollRecord[]` to Profile relations (after `leaveBalances LeaveBalance[]`).

Append to end of schema:

```prisma
enum PayrollStatus {
  DRAFT
  REVIEWED
  APPROVED
  PUBLISHED
  REJECTED
}

model PayrollRecord {
  id               String        @id @default(cuid())
  profileId        String
  periodMonth      Int
  periodYear       Int
  baseSalary       Decimal       @db.Decimal(15, 2)
  allowances       Decimal       @db.Decimal(15, 2) @default(0)
  grossSalary      Decimal       @db.Decimal(15, 2)
  totalDeductions  Decimal       @db.Decimal(15, 2) @default(0)
  netSalary        Decimal       @db.Decimal(15, 2)
  workingDays      Int
  actualDaysWorked Int
  status           PayrollStatus @default(DRAFT)
  notes            String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  profile          Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, periodMonth, periodYear])
  @@map("payroll_records")
}

model TaxConfig {
  id               String   @id @default(cuid())
  ptkpCategory     String
  ptkpAmount       Decimal  @db.Decimal(15, 2)
  bpjsHealthRate   Float
  bpjsEmployeeRate Float
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@map("tax_configs")
}
```

- [ ] **Step 3: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260612000003_add_hr_payroll/migration.sql
git commit -m "feat(hr): add PayrollRecord and TaxConfig models"
```

---

## Task 4: Migration — Recruitment & Onboarding

**Files:**
- Create: `prisma/migrations/20260612000004_add_hr_recruitment/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000004_add_hr_recruitment/migration.sql`:

```sql
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
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_jobPostingId_fkey"
  FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "onboarding_template_items" ADD CONSTRAINT "onboarding_template_items_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "onboarding_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "applicants_jobPostingId_idx" ON "applicants"("jobPostingId");
CREATE INDEX IF NOT EXISTS "interviews_applicantId_idx" ON "interviews"("applicantId");
CREATE INDEX IF NOT EXISTS "employee_onboardings_profileId_idx" ON "employee_onboardings"("profileId");
```

- [ ] **Step 2: Add to `prisma/schema.prisma`**

Add `onboardings EmployeeOnboarding[]` to Profile relations (after `payrollRecords PayrollRecord[]`).

Append to end of schema:

```prisma
enum PositionType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERNSHIP
}

enum JobStatus {
  OPEN
  CLOSED
}

enum ApplicantStatus {
  NEW
  REVIEWED
  INTERVIEWED
  OFFERED
  HIRED
  REJECTED
}

enum InterviewType {
  PHONE_SCREENING
  TECHNICAL
  HR_ROUND
  FINAL
}

enum InterviewStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum OfferStatus {
  PENDING
  ACCEPTED
  REJECTED
}

enum OnboardingStatus {
  IN_PROGRESS
  COMPLETED
}

model JobPosting {
  id                  String       @id @default(cuid())
  title               String
  department          String
  positionType        PositionType
  description         String
  location            String
  salaryRangeMin      Decimal?     @db.Decimal(15, 2)
  salaryRangeMax      Decimal?     @db.Decimal(15, 2)
  status              JobStatus    @default(OPEN)
  applicationDeadline DateTime?
  maxApplicants       Int?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  applicants          Applicant[]

  @@map("job_postings")
}

model Applicant {
  id              String          @id @default(cuid())
  jobPostingId    String
  fullName        String
  email           String
  phoneNumber     String?
  position        String
  applicationDate DateTime        @default(now())
  status          ApplicantStatus @default(NEW)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  jobPosting      JobPosting      @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  interviews      Interview[]
  jobOffers       JobOffer[]

  @@index([jobPostingId])
  @@map("applicants")
}

model Interview {
  id                       String          @id @default(cuid())
  applicantId              String
  interviewerId            String?
  scheduledDate            DateTime
  interviewType            InterviewType
  interviewLocation        String?
  interviewDurationMinutes Int             @default(60)
  status                   InterviewStatus @default(SCHEDULED)
  interviewNotes           String?
  createdAt                DateTime        @default(now())
  updatedAt                DateTime        @updatedAt
  applicant                Applicant       @relation(fields: [applicantId], references: [id], onDelete: Cascade)

  @@index([applicantId])
  @@map("interviews")
}

model JobOffer {
  id            String      @id @default(cuid())
  applicantId   String
  positionTitle String
  salary        Decimal     @db.Decimal(15, 2)
  startDate     DateTime
  status        OfferStatus @default(PENDING)
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  applicant     Applicant   @relation(fields: [applicantId], references: [id], onDelete: Cascade)

  @@map("job_offers")
}

model OnboardingTemplate {
  id          String                   @id @default(cuid())
  name        String
  description String?
  department  String?
  isActive    Boolean                  @default(true)
  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt
  items       OnboardingTemplateItem[]
  onboardings EmployeeOnboarding[]

  @@map("onboarding_templates")
}

model OnboardingTemplateItem {
  id         String             @id @default(cuid())
  templateId String
  title      String
  order      Int
  template   OnboardingTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@map("onboarding_template_items")
}

model EmployeeOnboarding {
  id                 String              @id @default(cuid())
  profileId          String
  templateId         String?
  startDate          DateTime
  status             OnboardingStatus    @default(IN_PROGRESS)
  progressPercentage Int                 @default(0)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  profile            Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)
  template           OnboardingTemplate? @relation(fields: [templateId], references: [id])

  @@index([profileId])
  @@map("employee_onboardings")
}
```

- [ ] **Step 3: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260612000004_add_hr_recruitment/migration.sql
git commit -m "feat(hr): add recruitment and onboarding models"
```

---

## Task 5: Migration — HR Development

**Files:**
- Create: `prisma/migrations/20260612000005_add_hr_development/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000005_add_hr_development/migration.sql`:

```sql
DO $$ BEGIN CREATE TYPE "TrainingStatus" AS ENUM ('SCHEDULED','ONGOING','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DevelopmentLevel" AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CertificationStatus" AS ENUM ('ACTIVE','PENDING','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "training_programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "participantsCount" INTEGER NOT NULL DEFAULT 0,
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_developments" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" "DevelopmentLevel" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetCompletionDate" TIMESTAMP(3),
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_developments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_certifications" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "CertificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "employee_developments" ADD CONSTRAINT "employee_developments_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "employee_developments_profileId_idx" ON "employee_developments"("profileId");
CREATE INDEX IF NOT EXISTS "employee_certifications_profileId_idx" ON "employee_certifications"("profileId");
```

- [ ] **Step 2: Add to `prisma/schema.prisma`**

Add to Profile relations (after `onboardings EmployeeOnboarding[]`):
```prisma
  developments     EmployeeDevelopment[]
  certifications   EmployeeCertification[]
```

Append to end of schema:

```prisma
enum TrainingStatus {
  SCHEDULED
  ONGOING
  COMPLETED
  CANCELLED
}

enum DevelopmentLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum CertificationStatus {
  ACTIVE
  PENDING
  EXPIRED
}

model TrainingProgram {
  id                   String         @id @default(cuid())
  name                 String
  description          String?
  startDate            DateTime
  endDate              DateTime
  status               TrainingStatus @default(SCHEDULED)
  participantsCount    Int            @default(0)
  completionPercentage Int            @default(0)
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  @@map("training_programs")
}

model EmployeeDevelopment {
  id                   String           @id @default(cuid())
  profileId            String
  skill                String
  level                DevelopmentLevel
  startDate            DateTime
  targetCompletionDate DateTime?
  progressPercentage   Int              @default(0)
  notes                String?
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
  profile              Profile          @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("employee_developments")
}

model EmployeeCertification {
  id                String              @id @default(cuid())
  profileId         String
  certificationName String
  issueDate         DateTime
  expiryDate        DateTime?
  status            CertificationStatus @default(ACTIVE)
  notes             String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  profile           Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("employee_certifications")
}
```

- [ ] **Step 3: Validate and commit**

```bash
npx prisma validate
git add prisma/schema.prisma prisma/migrations/20260612000005_add_hr_development/migration.sql
git commit -m "feat(hr): add HR development models (training, development, certification)"
```

---

## Task 6: Migration — Performance Management

**Files:**
- Create: `prisma/migrations/20260612000006_add_hr_performance/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000006_add_hr_performance/migration.sql`:

```sql
DO $$ BEGIN CREATE TYPE "ReviewStatus" AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "performance_reviews" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "strengths" TEXT,
    "comments" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kpis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "achievedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "progressPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "performance_reviews_profileId_idx" ON "performance_reviews"("profileId");
```

- [ ] **Step 2: Add to `prisma/schema.prisma`**

Add to Profile relations (after `certifications EmployeeCertification[]`):
```prisma
  performanceReviews PerformanceReview[]
```

Append to end of schema:

```prisma
enum ReviewStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  REJECTED
}

model PerformanceReview {
  id              String       @id @default(cuid())
  profileId       String
  periodStartDate DateTime
  periodEndDate   DateTime
  rating          Float
  strengths       String?
  comments        String?
  status          ReviewStatus @default(PENDING)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  profile         Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("performance_reviews")
}

model KPI {
  id                 String   @id @default(cuid())
  name               String
  description        String?
  department         String?
  targetValue        Float
  achievedValue      Float    @default(0)
  unit               String
  periodStartDate    DateTime
  periodEndDate      DateTime
  progressPercentage Float    @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@map("kpis")
}
```

- [ ] **Step 3: Validate and commit**

```bash
npx prisma validate
git add prisma/schema.prisma prisma/migrations/20260612000006_add_hr_performance/migration.sql
git commit -m "feat(hr): add PerformanceReview and KPI models"
```

---

## Task 7: Migration — Health Management

**Files:**
- Create: `prisma/migrations/20260612000007_add_hr_health/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000007_add_hr_health/migration.sql`:

```sql
DO $$ BEGIN CREATE TYPE "HealthStatus" AS ENUM ('NORMAL','SELESAI','PERLU_TINDAK_LANJUT','URGENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InsuranceStatus" AS ENUM ('AKTIF','BERAKHIR','EXPIRED','PENDING','NON_AKTIF'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "health_records" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "checkupType" TEXT NOT NULL,
    "checkupDate" TIMESTAMP(3) NOT NULL,
    "doctorName" TEXT,
    "findings" TEXT,
    "status" "HealthStatus" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_insurances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "insuranceType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "coverageAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "status" "InsuranceStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_insurances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "health_records" ADD CONSTRAINT "health_records_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_insurances" ADD CONSTRAINT "employee_insurances_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "health_records_profileId_idx" ON "health_records"("profileId");
CREATE INDEX IF NOT EXISTS "employee_insurances_profileId_idx" ON "employee_insurances"("profileId");
```

- [ ] **Step 2: Add to `prisma/schema.prisma`**

Add to Profile relations (after `performanceReviews PerformanceReview[]`):
```prisma
  healthRecords  HealthRecord[]
  insurances     EmployeeInsurance[]
```

Append to end of schema:

```prisma
enum HealthStatus {
  NORMAL
  SELESAI
  PERLU_TINDAK_LANJUT
  URGENT
}

enum InsuranceStatus {
  AKTIF
  BERAKHIR
  EXPIRED
  PENDING
  NON_AKTIF
}

model HealthRecord {
  id          String       @id @default(cuid())
  profileId   String
  checkupType String
  checkupDate DateTime
  doctorName  String?
  findings    String?
  status      HealthStatus @default(NORMAL)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  profile     Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("health_records")
}

model EmployeeInsurance {
  id             String          @id @default(cuid())
  profileId      String
  insuranceType  String
  provider       String
  policyNumber   String
  coverageAmount Decimal         @db.Decimal(15, 2) @default(0)
  expiryDate     DateTime?
  status         InsuranceStatus @default(AKTIF)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("employee_insurances")
}
```

- [ ] **Step 3: Validate and commit**

```bash
npx prisma validate
git add prisma/schema.prisma prisma/migrations/20260612000007_add_hr_health/migration.sql
git commit -m "feat(hr): add HealthRecord and EmployeeInsurance models"
```

---

## Task 8: Migration — Industrial Relations, Reimbursement & Loan

**Files:**
- Create: `prisma/migrations/20260612000008_add_hr_industrial/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `prisma/migrations/20260612000008_add_hr_industrial/migration.sql`:

```sql
DO $$ BEGIN CREATE TYPE "ReimbursementStatus" AS ENUM ('PENDING','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LoanStatus" AS ENUM ('PENDING','ACTIVE','COMPLETED','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisputeType" AS ENUM ('INDIVIDUAL','COLLECTIVE','PROCEDURAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisputeStatus" AS ENUM ('PENDING','IN_PROGRESS','RESOLVED','IN_REVIEW','UNDER_INVESTIGATION','ESCALATED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "reimbursements" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_loans" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "tenor" INTEGER NOT NULL,
    "monthlyInstallment" DECIMAL(15,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "labor_disputes" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "disputeType" "DisputeType" NOT NULL,
    "dateFiled" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "labor_disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_grievances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateFiled" TIMESTAMP(3) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_grievances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "labor_disputes" ADD CONSTRAINT "labor_disputes_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_grievances" ADD CONSTRAINT "employee_grievances_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "reimbursements_profileId_idx" ON "reimbursements"("profileId");
CREATE INDEX IF NOT EXISTS "employee_loans_profileId_idx" ON "employee_loans"("profileId");
CREATE INDEX IF NOT EXISTS "labor_disputes_profileId_idx" ON "labor_disputes"("profileId");
CREATE INDEX IF NOT EXISTS "employee_grievances_profileId_idx" ON "employee_grievances"("profileId");
```

- [ ] **Step 2: Add to `prisma/schema.prisma`**

Add to Profile relations (after `insurances EmployeeInsurance[]`):
```prisma
  reimbursements Reimbursement[]
  loans          EmployeeLoan[]
  laborDisputes  LaborDispute[]
  grievances     EmployeeGrievance[]
```

Append to end of schema:

```prisma
enum ReimbursementStatus {
  PENDING
  APPROVED
  REJECTED
}

enum LoanStatus {
  PENDING
  ACTIVE
  COMPLETED
  APPROVED
  REJECTED
}

enum DisputeType {
  INDIVIDUAL
  COLLECTIVE
  PROCEDURAL
}

enum DisputeStatus {
  PENDING
  IN_PROGRESS
  RESOLVED
  IN_REVIEW
  UNDER_INVESTIGATION
  ESCALATED
  REJECTED
}

model Reimbursement {
  id          String              @id @default(cuid())
  profileId   String
  description String
  amount      Decimal             @db.Decimal(15, 2)
  date        DateTime
  status      ReimbursementStatus @default(PENDING)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  profile     Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("reimbursements")
}

model EmployeeLoan {
  id                 String     @id @default(cuid())
  profileId          String
  amount             Decimal    @db.Decimal(15, 2)
  tenor              Int
  monthlyInstallment Decimal    @db.Decimal(15, 2)
  status             LoanStatus @default(PENDING)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  profile            Profile    @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("employee_loans")
}

model LaborDispute {
  id          String        @id @default(cuid())
  profileId   String
  disputeType DisputeType
  dateFiled   DateTime
  description String
  status      DisputeStatus @default(PENDING)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  profile     Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("labor_disputes")
}

model EmployeeGrievance {
  id          String        @id @default(cuid())
  profileId   String
  subject     String
  description String
  dateFiled   DateTime
  status      DisputeStatus @default(PENDING)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  profile     Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("employee_grievances")
}
```

- [ ] **Step 3: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260612000008_add_hr_industrial/migration.sql
git commit -m "feat(hr): add reimbursement, loan, industrial relations models"
```

---

## Task 9: Route Meta

**Files:**
- Modify: `lib/route-meta.ts`

- [ ] **Step 1: Add HR route entries**

In `lib/route-meta.ts`, find the `// ─── Pengadaan Barang ───` section (around line 161) and add a new section after it:

```ts
  // ─── HR & Payroll ──────────────────────────────────────────────────────────
  "/dashboard/hr": {
    title: "HR & Payroll",
    subtitle: "Kelola SDM, penggajian, dan administrasi karyawan",
  },
  "/dashboard/hr/database-karyawan": {
    title: "Database Karyawan",
    subtitle: "Data lengkap seluruh karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/manajemen-kehadiran": {
    title: "Manajemen Kehadiran",
    subtitle: "Monitoring kehadiran real-time",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/absensi": {
    title: "Absensi",
    subtitle: "Catat kehadiran dengan foto dan lokasi",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/sistem-cuti": {
    title: "Sistem Cuti",
    subtitle: "Pengajuan dan saldo cuti karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/penggajian-perpajakan": {
    title: "Penggajian & Perpajakan",
    subtitle: "Proses penggajian dan konfigurasi pajak",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/slip-gaji": {
    title: "Slip Gaji",
    subtitle: "Lihat dan unduh slip gaji",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/rekrutmen-onboarding": {
    title: "Rekrutmen & Onboarding",
    subtitle: "Pipeline rekrutmen hingga onboarding",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/pengembangan-sdm": {
    title: "Pengembangan SDM",
    subtitle: "Pelatihan, pengembangan, dan sertifikasi",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/manajemen-kinerja": {
    title: "Manajemen Kinerja",
    subtitle: "Review kinerja dan KPI karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/manajemen-kesehatan": {
    title: "Manajemen Kesehatan",
    subtitle: "Rekam medis dan asuransi karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/reimbursement-loan": {
    title: "Reimbursement & Loan",
    subtitle: "Klaim biaya dan pinjaman karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/hubungan-industrial": {
    title: "Hubungan Industrial",
    subtitle: "SP tracking dan pengaduan karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/analitik-laporan": {
    title: "Analitik & Laporan",
    subtitle: "Dashboard metrik HR dan laporan",
    parent: "/dashboard/hr",
  },
```

- [ ] **Step 2: Commit**

```bash
git add lib/route-meta.ts
git commit -m "feat(hr): add route-meta entries for all 14 HR routes"
```

---

## Task 10: Sidebar — Unhide HR Menu

**Files:**
- Modify: `app/(private)/dashboard/_components/sidebar/sidebar-config.ts`

- [ ] **Step 1: Remove `hidden: true` from HR entry**

In `app/(private)/dashboard/_components/sidebar/sidebar-config.ts`, find the HR & Payroll entry (around line 192) and remove the `hidden: true` line:

Remove this line:
```ts
    hidden: true, // TODO: sementara disembunyiin — balikin ke false/hapus buat munculin lagi
```

The object should now look like:
```ts
  {
    name: "HR & Payroll",
    href: "/dashboard/hr",
    icon: Accessibility,
    permission: { module: "hr", action: "view" },
    submenu: [
      { name: "Database Karyawan", href: "/dashboard/hr/database-karyawan", icon: UsersGroupRounded, permission: { module: "hr", action: "view" } },
      // ... rest of submenu unchanged
    ],
  },
```

- [ ] **Step 2: Commit**

```bash
git add "app/(private)/dashboard/_components/sidebar/sidebar-config.ts"
git commit -m "feat(hr): unhide HR & Payroll sidebar menu"
```

---

## Task 11: Stub Pages (all 13)

**Files:**
- Create: 13 files listed in File Map above

- [ ] **Step 1: Create stub page template**

Create each of the 13 files below with the same pattern (substitute `<Title>` with the module title from the route-meta):

`app/(private)/dashboard/hr/database-karyawan/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Database Karyawan" };

export default async function DatabaseKaryawanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Database Karyawan</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/manajemen-kehadiran/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Manajemen Kehadiran" };

export default async function ManajemenKehadiranPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Manajemen Kehadiran</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/absensi/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Absensi" };

export default async function AbsensiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Absensi</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/sistem-cuti/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Sistem Cuti" };

export default async function SistemCutiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Sistem Cuti</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/penggajian-perpajakan/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Penggajian & Perpajakan" };

export default async function PenggajianPerpajakanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Penggajian & Perpajakan</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/slip-gaji/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Slip Gaji" };

export default async function SlipGajiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Slip Gaji</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/rekrutmen-onboarding/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Rekrutmen & Onboarding" };

export default async function RekrutmenOnboardingPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Rekrutmen & Onboarding</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/pengembangan-sdm/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Pengembangan SDM" };

export default async function PengembanganSdmPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Pengembangan SDM</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/manajemen-kinerja/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Manajemen Kinerja" };

export default async function ManajemenKinerjaPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Manajemen Kinerja</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/manajemen-kesehatan/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Manajemen Kesehatan" };

export default async function ManajemenKesehatanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Manajemen Kesehatan</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/reimbursement-loan/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Reimbursement & Loan" };

export default async function ReimbursementLoanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Reimbursement & Loan</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/hubungan-industrial/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Hubungan Industrial" };

export default async function HubunganIndustrialPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Hubungan Industrial</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

`app/(private)/dashboard/hr/analitik-laporan/page.tsx`:
```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Analitik & Laporan" };

export default async function AnalitikLaporanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Analitik & Laporan</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit all stub pages**

```bash
git add "app/(private)/dashboard/hr/"
git commit -m "feat(hr): add 13 stub pages for all HR sub-modules"
```

---

## Task 12: TypeScript Build Verification

**Files:** None created — verification only

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. If errors appear, fix them before proceeding.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build completes successfully. Look for `✓ Compiled successfully` or similar. If build errors appear, read the error output carefully and fix the referenced file/line.

- [ ] **Step 3: Prisma final validation**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`
