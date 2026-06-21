# Database Karyawan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured employee database management module under `/dashboard/hr/database-karyawan` with CRUD, detail pages, document management, department/position management, and org chart.

**Architecture:** Enhance existing Profile model with employment fields. Add Department, Position, EmployeeDocument, EmploymentHistory models. Follow existing patterns from Vendor CRUD (actions → queries → API routes → services → hooks → UI components). Employee creation wraps existing `inviteUser` flow with HR-specific fields.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Neon HTTP adapter), Zod v4, TanStack Query v5, shadcn v4 + Tailwind v4, Solar Icons BoldDuotone, Cloudflare R2 for document storage.

**Spec:** `docs/superpowers/specs/2026-06-21-database-karyawan-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `prisma/migrations/20260621120000_add_employee_database/migration.sql` | Schema migration + permission seeds |
| `lib/validations/employee.ts` | Zod schemas for employee CRUD + list query |
| `lib/validations/department.ts` | Zod schemas for department CRUD |
| `lib/validations/position.ts` | Zod schemas for position CRUD |
| `lib/queries/employees.ts` | Server-side queries: getEmployees, getEmployeeById |
| `lib/queries/departments.ts` | Server-side queries: getDepartments, getDepartmentTree |
| `lib/queries/positions.ts` | Server-side queries: getPositions |
| `actions/employee.ts` | Server actions: createEmployee, updateEmployee, deleteEmployee, uploadDocument, deleteDocument, addHistory |
| `actions/department.ts` | Server actions: CRUD departments |
| `actions/position.ts` | Server actions: CRUD positions |
| `services/employeeService.ts` | Client fetch wrappers for employee API routes |
| `services/departmentService.ts` | Client fetch wrappers for department API routes |
| `services/positionService.ts` | Client fetch wrappers for position API routes |
| `hooks/useEmployees.ts` | TanStack Query hooks for employees |
| `hooks/useDepartments.ts` | TanStack Query hooks for departments |
| `hooks/usePositions.ts` | TanStack Query hooks for positions |
| `app/api/hr/employees/route.ts` | GET employee list (paginated, filtered) |
| `app/api/hr/employees/[id]/route.ts` | GET employee detail |
| `app/api/hr/employees/[id]/documents/route.ts` | GET employee documents |
| `app/api/hr/employees/[id]/history/route.ts` | GET employee history |
| `app/api/hr/employees/export/route.ts` | GET CSV export |
| `app/api/hr/departments/route.ts` | GET departments |
| `app/api/hr/positions/route.ts` | GET positions |
| `app/(private)/dashboard/hr/database-karyawan/page.tsx` | Employee list page |
| `app/(private)/dashboard/hr/database-karyawan/[id]/page.tsx` | Employee detail page |
| `app/(private)/dashboard/hr/database-karyawan/_components/EmployeesTable.tsx` | Main table + search + pagination |
| `app/(private)/dashboard/hr/database-karyawan/_components/EmployeeDrawer.tsx` | Create/edit employee drawer |
| `app/(private)/dashboard/hr/database-karyawan/_components/EmployeeFilters.tsx` | Filter bar component |
| `app/(private)/dashboard/hr/database-karyawan/_components/EmployeeDetailTabs.tsx` | Tabbed detail container |
| `app/(private)/dashboard/hr/database-karyawan/_components/PersonalInfoSection.tsx` | Tab 1: personal data |
| `app/(private)/dashboard/hr/database-karyawan/_components/EmploymentSection.tsx` | Tab 2: employment data |
| `app/(private)/dashboard/hr/database-karyawan/_components/PayrollSection.tsx` | Tab 3: payroll/bank/BPJS |
| `app/(private)/dashboard/hr/database-karyawan/_components/DocumentsSection.tsx` | Tab 4: document management |
| `app/(private)/dashboard/hr/database-karyawan/_components/DocumentUploadModal.tsx` | Document upload dialog |
| `app/(private)/dashboard/hr/database-karyawan/_components/HistorySection.tsx` | Tab 5: employment history timeline |
| `app/(private)/dashboard/hr/database-karyawan/_components/DepartmentManager.tsx` | Department CRUD tree view |
| `app/(private)/dashboard/hr/database-karyawan/_components/PositionManager.tsx` | Position CRUD table |
| `app/(private)/dashboard/hr/database-karyawan/_components/OrgChart.tsx` | Organization chart |

### Modified Files

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add enums, fields to Profile, new models |
| `lib/route-meta.ts` | Add Database Karyawan route entries |
| `app/(private)/dashboard/_components/sidebar/sidebar-config.ts` | Ensure Database Karyawan menu visible |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260621120000_add_employee_database/migration.sql`

- [ ] **Step 1: Add new enums to `prisma/schema.prisma`**

After the existing `AttendanceStatus` enum (line ~546), add:

```prisma
enum Religion {
  islam
  kristen
  katolik
  hindu
  buddha
  konghucu
}

enum EmploymentType {
  permanent
  contract
  probation
  intern
}
```

- [ ] **Step 2: Add Department model to `prisma/schema.prisma`**

After the `AttendanceSettings` model (end of file), add:

```prisma
// ─── HR Employee Database ────────────────────────────────────────────────────

model Department {
  id          String       @id @default(uuid())
  name        String       @unique
  description String?
  parentId    String?
  headId      String?
  sortOrder   Int          @default(0)
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  parent      Department?  @relation("DepartmentHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Department[] @relation("DepartmentHierarchy")
  head        Profile?     @relation("DepartmentHead", fields: [headId], references: [id], onDelete: SetNull)
  profiles    Profile[]
  positions   Position[]

  @@index([parentId])
  @@index([headId])
  @@map("departments")
}
```

- [ ] **Step 3: Add Position model to `prisma/schema.prisma`**

```prisma
model Position {
  id           String      @id @default(uuid())
  name         String      @unique
  departmentId String?
  level        Int         @default(0)
  sortOrder    Int         @default(0)
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  department   Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  profiles     Profile[]

  @@index([departmentId])
  @@map("positions")
}
```

- [ ] **Step 4: Add EmployeeDocument model to `prisma/schema.prisma`**

```prisma
model EmployeeDocument {
  id          String    @id @default(uuid())
  profileId   String
  type        String
  name        String
  fileUrl     String
  fileSize    Int       @default(0)
  expiresAt   DateTime?
  uploadedBy  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  profile     Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  uploader    Profile?  @relation("DocumentUploader", fields: [uploadedBy], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([uploadedBy])
  @@map("employee_documents")
}
```

- [ ] **Step 5: Add EmploymentHistory model to `prisma/schema.prisma`**

```prisma
model EmploymentHistory {
  id            String   @id @default(uuid())
  profileId     String
  changeType    String
  description   String
  oldValue      String?
  newValue      String?
  effectiveDate DateTime
  createdBy     String?
  createdAt     DateTime @default(now())

  profile       Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  creator       Profile? @relation("HistoryCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([effectiveDate])
  @@index([createdBy])
  @@map("employment_histories")
}
```

- [ ] **Step 6: Add new fields to Profile model in `prisma/schema.prisma`**

Add these fields to the Profile model after the `emergencyContactPhone` field (around line 104):

```prisma
  // HR Employment
  npwp                  String?
  bpjsKesehatan         String?
  bpjsKetenagakerjaan   String?
  religion              Religion?
  bloodType             String?
  joinDate              DateTime?
  resignDate            DateTime?
  employmentType        EmploymentType?
  contractStartDate     DateTime?
  contractEndDate       DateTime?
  departmentId          String?
  positionId            String?
```

Add these relations to Profile after the existing `attendances` relation (around line 152):

```prisma
  department             Department?          @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  position               Position?            @relation(fields: [positionId], references: [id], onDelete: SetNull)
  departmentsHeaded      Department[]         @relation("DepartmentHead")
  employeeDocuments      EmployeeDocument[]
  uploadedEmployeeDocs   EmployeeDocument[]   @relation("DocumentUploader")
  employmentHistories    EmploymentHistory[]
  createdHistoryEntries  EmploymentHistory[]  @relation("HistoryCreator")
```

Add indexes to Profile:

```prisma
  @@index([departmentId])
  @@index([positionId])
```

- [ ] **Step 7: Create migration SQL file**

Create `prisma/migrations/20260621120000_add_employee_database/migration.sql`:

```sql
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
```

- [ ] **Step 8: Validate Prisma schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 9: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621120000_add_employee_database/migration.sql
git commit -m "feat(hr): add employee database schema, migration, and permissions"
```

---

### Task 2: Validation Schemas

**Files:**
- Create: `lib/validations/employee.ts`
- Create: `lib/validations/department.ts`
- Create: `lib/validations/position.ts`

- [ ] **Step 1: Create `lib/validations/employee.ts`**

```typescript
import { z } from "zod";

export const createEmployeeSchema = z.object({
  email: z.string().email("Email tidak valid"),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  nickName: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  phoneNumber: z.string().optional(),
  nik: z.string().optional(),
  kkNumber: z.string().optional(),
  placeOfBirth: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  religion: z.enum(["islam", "kristen", "katolik", "hindu", "buddha", "konghucu"]).optional(),
  bloodType: z.string().optional(),
  ktpAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  city: z.string().optional(),
  motherName: z.string().optional(),
  maritalStatus: z.string().optional(),
  numberOfChildren: z.number().int().min(0).optional(),
  lastEducation: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRel: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  npwp: z.string().optional(),
  bpjsKesehatan: z.string().optional(),
  bpjsKetenagakerjaan: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  managerId: z.string().optional(),
  roleId: z.string().optional(),
  dataScope: z.enum(["own", "group", "all"]).optional(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
  joinDate: z.coerce.date().optional(),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.omit({ email: true }).partial();

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
});

export const uploadDocumentSchema = z.object({
  type: z.enum(["ktp", "npwp", "bpjs_kes", "bpjs_tk", "contract", "ijazah", "certificate", "other"]),
  name: z.string().min(1, "Nama dokumen wajib diisi"),
  expiresAt: z.coerce.date().optional(),
});

export const addHistorySchema = z.object({
  changeType: z.enum(["promotion", "transfer", "demotion", "status_change", "contract_renewal", "salary_change", "join", "resign", "other"]),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  effectiveDate: z.coerce.date(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type AddHistoryInput = z.infer<typeof addHistorySchema>;
```

- [ ] **Step 2: Create `lib/validations/department.ts`**

```typescript
import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Nama departemen wajib diisi"),
  description: z.string().optional(),
  parentId: z.string().optional(),
  headId: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
```

- [ ] **Step 3: Create `lib/validations/position.ts`**

```typescript
import { z } from "zod";

export const createPositionSchema = z.object({
  name: z.string().min(1, "Nama posisi wajib diisi"),
  departmentId: z.string().optional(),
  level: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(0),
});

export const updatePositionSchema = createPositionSchema.partial();

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in the new validation files

- [ ] **Step 5: Commit**

```bash
git add lib/validations/employee.ts lib/validations/department.ts lib/validations/position.ts
git commit -m "feat(hr): add Zod validation schemas for employee, department, position"
```

---

### Task 3: Database Queries

**Files:**
- Create: `lib/queries/employees.ts`
- Create: `lib/queries/departments.ts`
- Create: `lib/queries/positions.ts`

- [ ] **Step 1: Create `lib/queries/employees.ts`**

```typescript
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function getEmployees(params: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  employmentType?: string;
}): Promise<{ data: EmployeeListItem[]; total: number; page: number; limit: number }> {
  "use cache";
  cacheTag("employees");
  cacheLife("minutes");

  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Prisma.ProfileWhereInput = {};

  if (params.search) {
    const s = params.search;
    where.OR = [
      { fullName: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { nik: { contains: s, mode: "insensitive" } },
      { employeeNumber: isNaN(Number(s)) ? undefined : Number(s) },
    ].filter(Boolean) as Prisma.ProfileWhereInput[];
  }
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.positionId) where.positionId = params.positionId;
  if (params.status) where.status = params.status as Prisma.EnumProfileStatusFilter;
  if (params.employmentType) where.employmentType = params.employmentType as Prisma.EnumEmploymentTypeNullableFilter;

  const select = {
    id: true,
    employeeNumber: true,
    fullName: true,
    email: true,
    avatarUrl: true,
    status: true,
    employmentType: true,
    joinDate: true,
    phoneNumber: true,
    department: { select: { id: true, name: true } },
    position: { select: { id: true, name: true } },
  } satisfies Prisma.ProfileSelect;

  const [data, total] = await Promise.all([
    db.profile.findMany({
      where,
      select,
      orderBy: { employeeNumber: "asc" },
      skip,
      take: limit,
    }),
    db.profile.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getEmployeeById(id: string): Promise<EmployeeDetail | null> {
  "use cache";
  cacheTag("employees");
  cacheLife("minutes");

  return db.profile.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      employeeNumber: true,
      email: true,
      fullName: true,
      nickName: true,
      gender: true,
      phoneNumber: true,
      avatarUrl: true,
      nik: true,
      kkNumber: true,
      placeOfBirth: true,
      dateOfBirth: true,
      ktpAddress: true,
      currentAddress: true,
      city: true,
      motherName: true,
      maritalStatus: true,
      numberOfChildren: true,
      lastEducation: true,
      emergencyContactName: true,
      emergencyContactRel: true,
      emergencyContactPhone: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      npwp: true,
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      religion: true,
      bloodType: true,
      joinDate: true,
      resignDate: true,
      employmentType: true,
      contractStartDate: true,
      contractEndDate: true,
      status: true,
      roleId: true,
      managerId: true,
      dataScope: true,
      departmentId: true,
      positionId: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      manager: { select: { id: true, fullName: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function getEmployeeDocuments(profileId: string): Promise<EmployeeDocumentItem[]> {
  return db.employeeDocument.findMany({
    where: { profileId },
    select: {
      id: true,
      type: true,
      name: true,
      fileUrl: true,
      fileSize: true,
      expiresAt: true,
      createdAt: true,
      uploader: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getEmploymentHistory(profileId: string): Promise<EmploymentHistoryItem[]> {
  return db.employmentHistory.findMany({
    where: { profileId },
    select: {
      id: true,
      changeType: true,
      description: true,
      oldValue: true,
      newValue: true,
      effectiveDate: true,
      createdAt: true,
      creator: { select: { id: true, fullName: true } },
    },
    orderBy: { effectiveDate: "desc" },
    take: 200,
  });
}

export async function getEmployeesForExport(params: {
  departmentId?: string;
  status?: string;
}): Promise<EmployeeExportRow[]> {
  const where: Prisma.ProfileWhereInput = {};
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status as Prisma.EnumProfileStatusFilter;

  return db.profile.findMany({
    where,
    select: {
      employeeNumber: true,
      fullName: true,
      email: true,
      nik: true,
      phoneNumber: true,
      gender: true,
      religion: true,
      bloodType: true,
      placeOfBirth: true,
      dateOfBirth: true,
      maritalStatus: true,
      lastEducation: true,
      employmentType: true,
      joinDate: true,
      status: true,
      npwp: true,
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
    orderBy: { employeeNumber: "asc" },
    take: 5000,
  });
}

export type EmployeeListItem = Awaited<ReturnType<typeof getEmployees>>["data"][number];
export type EmployeeDetail = NonNullable<Awaited<ReturnType<typeof getEmployeeById>>>;
export type EmployeeDocumentItem = Awaited<ReturnType<typeof getEmployeeDocuments>>[number];
export type EmploymentHistoryItem = Awaited<ReturnType<typeof getEmploymentHistory>>[number];
export type EmployeeExportRow = Awaited<ReturnType<typeof getEmployeesForExport>>[number];
```

- [ ] **Step 2: Create `lib/queries/departments.ts`**

```typescript
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getDepartments(): Promise<DepartmentItem[]> {
  "use cache";
  cacheTag("departments");
  cacheLife("minutes");

  return db.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      head: { select: { id: true, fullName: true } },
      _count: { select: { profiles: true, children: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
}

export async function getDepartmentTree(): Promise<DepartmentItem[]> {
  "use cache";
  cacheTag("departments");
  cacheLife("minutes");

  return db.department.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      head: { select: { id: true, fullName: true } },
      _count: { select: { profiles: true, children: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
}

export type DepartmentItem = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  head: { id: string; fullName: string | null } | null;
  _count: { profiles: number; children: number };
};
```

- [ ] **Step 3: Create `lib/queries/positions.ts`**

```typescript
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPositions(departmentId?: string): Promise<PositionItem[]> {
  "use cache";
  cacheTag("positions");
  cacheLife("minutes");

  const where = departmentId ? { departmentId, isActive: true } : { isActive: true };

  return db.position.findMany({
    where,
    select: {
      id: true,
      name: true,
      departmentId: true,
      level: true,
      sortOrder: true,
      isActive: true,
      department: { select: { id: true, name: true } },
      _count: { select: { profiles: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { sortOrder: "asc" }],
    take: 500,
  });
}

export type PositionItem = {
  id: string;
  name: string;
  departmentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  department: { id: string; name: string } | null;
  _count: { profiles: number };
};
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in query files

- [ ] **Step 5: Commit**

```bash
git add lib/queries/employees.ts lib/queries/departments.ts lib/queries/positions.ts
git commit -m "feat(hr): add database query functions for employees, departments, positions"
```

---

### Task 4: Server Actions — Department & Position CRUD

**Files:**
- Create: `actions/department.ts`
- Create: `actions/position.ts`

- [ ] **Step 1: Create `actions/department.ts`**

```typescript
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createDepartmentSchema, updateDepartmentSchema } from "@/lib/validations/department";

export async function createDepartment(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-departments", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`dept-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createDepartmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [dept] = await db.$transaction([
      db.department.create({ data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "department.create",
      entityType: "department",
      entityId: dept.id,
      description: `Departemen "${dept.name}" dibuat`,
    });

    revalidateTag("departments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama departemen sudah digunakan." };
    }
    console.error("[createDepartment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateDepartment(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-departments", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`dept-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateDepartmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [dept] = await db.$transaction([
      db.department.update({ where: { id }, data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "department.update",
      entityType: "department",
      entityId: id,
      description: `Departemen "${dept.name}" diperbarui`,
    });

    revalidateTag("departments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama departemen sudah digunakan." };
    }
    console.error("[updateDepartment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteDepartment(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-departments", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`dept-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const dept = await db.department.findUnique({
      where: { id },
      select: { name: true, _count: { select: { profiles: true } } },
    });
    if (!dept) return { success: false, error: "Departemen tidak ditemukan." };
    if (dept._count.profiles > 0) {
      return { success: false, error: "Tidak bisa menghapus departemen yang masih memiliki karyawan. Pindahkan karyawan terlebih dahulu." };
    }

    await db.$transaction([db.department.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "department.delete",
      entityType: "department",
      entityId: id,
      description: `Departemen "${dept.name}" dihapus`,
    });

    revalidateTag("departments", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteDepartment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
```

- [ ] **Step 2: Create `actions/position.ts`**

```typescript
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createPositionSchema, updatePositionSchema } from "@/lib/validations/position";

export async function createPosition(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-positions", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pos-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createPositionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [pos] = await db.$transaction([
      db.position.create({ data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "position.create",
      entityType: "position",
      entityId: pos.id,
      description: `Posisi "${pos.name}" dibuat`,
    });

    revalidateTag("positions", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama posisi sudah digunakan." };
    }
    console.error("[createPosition]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updatePosition(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-positions", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pos-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updatePositionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [pos] = await db.$transaction([
      db.position.update({ where: { id }, data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "position.update",
      entityType: "position",
      entityId: id,
      description: `Posisi "${pos.name}" diperbarui`,
    });

    revalidateTag("positions", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama posisi sudah digunakan." };
    }
    console.error("[updatePosition]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePosition(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-positions", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pos-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const pos = await db.position.findUnique({
      where: { id },
      select: { name: true, _count: { select: { profiles: true } } },
    });
    if (!pos) return { success: false, error: "Posisi tidak ditemukan." };
    if (pos._count.profiles > 0) {
      return { success: false, error: "Tidak bisa menghapus posisi yang masih memiliki karyawan. Pindahkan karyawan terlebih dahulu." };
    }

    await db.$transaction([db.position.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "position.delete",
      entityType: "position",
      entityId: id,
      description: `Posisi "${pos.name}" dihapus`,
    });

    revalidateTag("positions", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePosition]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add actions/department.ts actions/position.ts
git commit -m "feat(hr): add server actions for department and position CRUD"
```

---

### Task 5: Server Actions — Employee CRUD

**Files:**
- Create: `actions/employee.ts`

- [ ] **Step 1: Create `actions/employee.ts`**

This is a large file. The `createEmployee` action wraps the invite flow from `actions/user.ts` but adds HR-specific fields.

```typescript
"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { uploadToR2, deleteFromR2, extractKeyFromUrl } from "@/lib/r2";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  uploadDocumentSchema,
  addHistorySchema,
} from "@/lib/validations/employee";
import type { Prisma } from "@prisma/client";

function getBaseUrl(): string {
  return process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

export async function createEmployee(data: unknown): Promise<{ success: boolean; error?: string; message?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!mutationLimiter.check(`emp-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createEmployeeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { email, fullName, roleId, managerId, dataScope, departmentId, positionId, employmentType, joinDate, contractStartDate, contractEndDate, ...profileFields } = parsed.data;

  try {
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const user = await db.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        profile: {
          create: {
            email,
            fullName,
            roleId: roleId ?? null,
            managerId: managerId ?? null,
            dataScope: (dataScope as "own" | "group" | "all") ?? "own",
            departmentId: departmentId ?? null,
            positionId: positionId ?? null,
            employmentType: employmentType ?? null,
            joinDate: joinDate ?? null,
            contractStartDate: contractStartDate ?? null,
            contractEndDate: contractEndDate ?? null,
            isEmailVerified: false,
            mustChangePassword: true,
            invitedAt: new Date(),
            invitedBy: session!.user.profileId,
            ...profileFields,
            emailVerificationTokens: {
              create: { token, expiresAt },
            },
          },
        },
      },
      select: { id: true, profile: { select: { id: true } } },
    });

    const profileId = user.profile!.id;

    if (joinDate) {
      await db.employmentHistory.create({
        data: {
          profileId,
          changeType: "join",
          description: `Bergabung sebagai karyawan`,
          newValue: fullName,
          effectiveDate: joinDate,
          createdBy: session!.user.profileId,
        },
      });
    }

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const baseUrl = getBaseUrl();
      const verificationLink = `${baseUrl}/auth/verify?token=${token}`;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Undangan Bergabung — Swasana",
        html: `<p>Halo ${fullName},</p><p>Anda diundang untuk bergabung ke Swasana. Klik link berikut untuk verifikasi email dan mengatur password:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>Link berlaku 7 hari.</p>`,
      });
    } catch (emailErr) {
      console.error("[createEmployee] Email send failed:", emailErr);
    }

    await logAudit({
      userId: session!.user.id,
      action: "employee.create",
      entityType: "profile",
      entityId: profileId,
      description: `Karyawan ${email} ditambahkan`,
      changes: { after: { email, fullName, departmentId, positionId, employmentType } },
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("employees", "max");
    revalidateTag("users", "max");
    return { success: true, message: "Karyawan berhasil ditambahkan. Undangan dikirim ke email." };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Email sudah terdaftar." };
    }
    console.error("[createEmployee]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateEmployee(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateEmployeeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const current = await db.profile.findUnique({
      where: { id },
      select: {
        departmentId: true,
        positionId: true,
        status: true,
        employmentType: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
    if (!current) return { success: false, error: "Karyawan tidak ditemukan." };

    const historyEntries: Prisma.EmploymentHistoryCreateManyInput[] = [];
    const profileId = id;
    const now = new Date();

    if (parsed.data.departmentId !== undefined && parsed.data.departmentId !== current.departmentId) {
      const newDept = parsed.data.departmentId
        ? await db.department.findUnique({ where: { id: parsed.data.departmentId }, select: { name: true } })
        : null;
      historyEntries.push({
        profileId,
        changeType: "transfer",
        description: `Pindah departemen`,
        oldValue: current.department?.name ?? "-",
        newValue: newDept?.name ?? "-",
        effectiveDate: now,
        createdBy: session!.user.profileId,
      });
    }

    if (parsed.data.positionId !== undefined && parsed.data.positionId !== current.positionId) {
      const newPos = parsed.data.positionId
        ? await db.position.findUnique({ where: { id: parsed.data.positionId }, select: { name: true } })
        : null;
      historyEntries.push({
        profileId,
        changeType: "promotion",
        description: `Perubahan posisi`,
        oldValue: current.position?.name ?? "-",
        newValue: newPos?.name ?? "-",
        effectiveDate: now,
        createdBy: session!.user.profileId,
      });
    }

    if (parsed.data.status !== undefined && parsed.data.status !== current.status) {
      historyEntries.push({
        profileId,
        changeType: "status_change",
        description: `Perubahan status`,
        oldValue: current.status,
        newValue: parsed.data.status,
        effectiveDate: now,
        createdBy: session!.user.profileId,
      });
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.profile.update({ where: { id }, data: parsed.data }),
    ];

    if (historyEntries.length > 0) {
      ops.push(
        ...historyEntries.map((entry) => db.employmentHistory.create({ data: entry }))
      );
    }

    if (parsed.data.fullName) {
      ops.push(
        db.user.update({
          where: { id: (await db.profile.findUnique({ where: { id }, select: { userId: true } }))!.userId },
          data: { name: parsed.data.fullName },
        })
      );
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "employee.update",
      entityType: "profile",
      entityId: id,
      description: `Data karyawan diperbarui`,
      changes: { after: parsed.data },
    });

    revalidateTag("employees", "max");
    revalidateTag("users", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateEmployee]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const profile = await db.profile.findUnique({
      where: { id },
      select: { fullName: true, email: true },
    });
    if (!profile) return { success: false, error: "Karyawan tidak ditemukan." };

    await db.$transaction([
      db.profile.update({
        where: { id },
        data: { status: "inactive", resignDate: new Date() },
      }),
      db.employmentHistory.create({
        data: {
          profileId: id,
          changeType: "resign",
          description: "Status diubah menjadi tidak aktif",
          oldValue: "active",
          newValue: "inactive",
          effectiveDate: new Date(),
          createdBy: session!.user.profileId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "employee.delete",
      entityType: "profile",
      entityId: id,
      description: `Karyawan "${profile.fullName}" dinonaktifkan`,
    });

    revalidateTag("employees", "max");
    revalidateTag("users", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployee]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function uploadEmployeeDocument(
  profileId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-doc-upload:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "File wajib diunggah." };

  const metaParsed = uploadDocumentSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name") || file.name,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!metaParsed.success) return { success: false, error: metaParsed.error.issues[0].message };

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) return { success: false, error: "Ukuran file maks 10MB." };

  try {
    const ext = file.name.split(".").pop() ?? "bin";
    const key = `employees/${profileId}/documents/${metaParsed.data.type}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadToR2(buffer, key, file.type);

    const [doc] = await db.$transaction([
      db.employeeDocument.create({
        data: {
          profileId,
          type: metaParsed.data.type,
          name: metaParsed.data.name,
          fileUrl,
          fileSize: file.size,
          expiresAt: metaParsed.data.expiresAt ?? null,
          uploadedBy: session!.user.profileId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "employee.document_upload",
      entityType: "employee_document",
      entityId: doc.id,
      description: `Dokumen "${metaParsed.data.name}" diunggah untuk karyawan ${profileId}`,
    });

    revalidateTag("employees", "max");
    return { success: true };
  } catch (e) {
    console.error("[uploadEmployeeDocument]", e);
    return { success: false, error: "Terjadi kesalahan saat mengunggah." };
  }
}

export async function deleteEmployeeDocument(docId: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-doc-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const doc = await db.employeeDocument.findUnique({
      where: { id: docId },
      select: { id: true, name: true, fileUrl: true, profileId: true },
    });
    if (!doc) return { success: false, error: "Dokumen tidak ditemukan." };

    try {
      await deleteFromR2(extractKeyFromUrl(doc.fileUrl));
    } catch (r2Err) {
      console.error("[deleteEmployeeDocument] R2 delete failed:", r2Err);
    }

    await db.$transaction([db.employeeDocument.delete({ where: { id: docId } })]);

    await logAudit({
      userId: session!.user.id,
      action: "employee.document_delete",
      entityType: "employee_document",
      entityId: docId,
      description: `Dokumen "${doc.name}" dihapus dari karyawan ${doc.profileId}`,
    });

    revalidateTag("employees", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployeeDocument]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function addEmploymentHistory(profileId: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-history:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addHistorySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [entry] = await db.$transaction([
      db.employmentHistory.create({
        data: {
          profileId,
          changeType: parsed.data.changeType,
          description: parsed.data.description,
          oldValue: parsed.data.oldValue ?? null,
          newValue: parsed.data.newValue ?? null,
          effectiveDate: parsed.data.effectiveDate,
          createdBy: session!.user.profileId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "employee.history_add",
      entityType: "employment_history",
      entityId: entry.id,
      description: `Riwayat "${parsed.data.changeType}" ditambahkan untuk karyawan ${profileId}`,
    });

    revalidateTag("employees", "max");
    return { success: true };
  } catch (e) {
    console.error("[addEmploymentHistory]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add actions/employee.ts
git commit -m "feat(hr): add server actions for employee CRUD, document upload, history"
```

---

### Task 6: API Routes

**Files:**
- Create: `app/api/hr/employees/route.ts`
- Create: `app/api/hr/employees/[id]/route.ts`
- Create: `app/api/hr/employees/[id]/documents/route.ts`
- Create: `app/api/hr/employees/[id]/history/route.ts`
- Create: `app/api/hr/employees/export/route.ts`
- Create: `app/api/hr/departments/route.ts`
- Create: `app/api/hr/positions/route.ts`

- [ ] **Step 1: Create `app/api/hr/employees/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployees } from "@/lib/queries/employees";
import { employeeListQuerySchema } from "@/lib/validations/employee";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employees-list:${session.user.id}`)) return rateLimitResponse();

  const canViewAll = await hasPermission(session.user.roleId, "hr", "view-all");
  const canView = canViewAll || await hasPermission(session.user.roleId, "hr", "view");
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const params = employeeListQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      positionId: url.searchParams.get("positionId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      employmentType: url.searchParams.get("employmentType") ?? undefined,
    });

    const result = await getEmployees(params);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/hr/employees/[id]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployeeById } from "@/lib/queries/employees";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employee-detail:${session.user.id}`)) return rateLimitResponse();

  const canViewAll = await hasPermission(session.user.roleId, "hr", "view-all");
  const canView = canViewAll || await hasPermission(session.user.roleId, "hr", "view");
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const employee = await getEmployeeById(id);
    if (!employee) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json(employee);
  } catch {
    return Response.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/hr/employees/[id]/documents/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployeeDocuments } from "@/lib/queries/employees";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employee-docs:${session.user.id}`)) return rateLimitResponse();

  const canView = await hasPermission(session.user.roleId, "hr", "view-all")
    || await hasPermission(session.user.roleId, "hr", "view");
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const docs = await getEmployeeDocuments(id);
    return Response.json(docs);
  } catch {
    return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/hr/employees/[id]/history/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmploymentHistory } from "@/lib/queries/employees";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employee-history:${session.user.id}`)) return rateLimitResponse();

  const canView = await hasPermission(session.user.roleId, "hr", "view-all")
    || await hasPermission(session.user.roleId, "hr", "view");
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const history = await getEmploymentHistory(id);
    return Response.json(history);
  } catch {
    return Response.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/api/hr/employees/export/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployeesForExport } from "@/lib/queries/employees";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employees-export:${session.user.id}`)) return rateLimitResponse();

  const canExport = await hasPermission(session.user.roleId, "hr", "export");
  if (!canExport) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const rows = await getEmployeesForExport({ departmentId, status });

    const headers = [
      "No Karyawan", "Nama Lengkap", "Email", "NIK", "No. Telp", "Gender",
      "Agama", "Gol. Darah", "Tempat Lahir", "Tgl Lahir", "Status Perkawinan",
      "Pendidikan", "Tipe Karyawan", "Tgl Masuk", "Status",
      "NPWP", "BPJS Kesehatan", "BPJS TK",
      "Bank", "No Rekening", "Pemilik Rekening",
      "Departemen", "Posisi",
    ];

    const csvRows = rows.map((r) => [
      r.employeeNumber,
      r.fullName ?? "",
      r.email,
      r.nik ?? "",
      r.phoneNumber ?? "",
      r.gender ?? "",
      r.religion ?? "",
      r.bloodType ?? "",
      r.placeOfBirth ?? "",
      r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().slice(0, 10) : "",
      r.maritalStatus ?? "",
      r.lastEducation ?? "",
      r.employmentType ?? "",
      r.joinDate ? new Date(r.joinDate).toISOString().slice(0, 10) : "",
      r.status,
      r.npwp ?? "",
      r.bpjsKesehatan ?? "",
      r.bpjsKetenagakerjaan ?? "",
      r.bankName ?? "",
      r.bankAccountNumber ?? "",
      r.bankAccountHolder ?? "",
      r.department?.name ?? "",
      r.position?.name ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...csvRows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="karyawan-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return Response.json({ error: "Failed to export" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create `app/api/hr/departments/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getDepartments } from "@/lib/queries/departments";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`departments-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getDepartments();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Create `app/api/hr/positions/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPositions } from "@/lib/queries/positions";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`positions-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const result = await getPositions(departmentId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch positions" }, { status: 500 });
  }
}
```

- [ ] **Step 8: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in API route files

- [ ] **Step 9: Commit**

```bash
git add app/api/hr/employees/ app/api/hr/departments/ app/api/hr/positions/
git commit -m "feat(hr): add API routes for employees, departments, positions"
```

---

### Task 7: Services + Hooks + Route Meta

**Files:**
- Create: `services/employeeService.ts`
- Create: `services/departmentService.ts`
- Create: `services/positionService.ts`
- Create: `hooks/useEmployees.ts`
- Create: `hooks/useDepartments.ts`
- Create: `hooks/usePositions.ts`
- Modify: `lib/route-meta.ts`

- [ ] **Step 1: Create `services/employeeService.ts`**

```typescript
import type { EmployeeListItem, EmployeeDetail, EmployeeDocumentItem, EmploymentHistoryItem } from "@/lib/queries/employees";

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchEmployees(params: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  employmentType?: string;
}): Promise<PaginatedResult<EmployeeListItem>> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.search) sp.set("search", params.search);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.positionId) sp.set("positionId", params.positionId);
  if (params.status) sp.set("status", params.status);
  if (params.employmentType) sp.set("employmentType", params.employmentType);

  const res = await fetch(`/api/hr/employees?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
}

export async function fetchEmployeeById(id: string): Promise<EmployeeDetail> {
  const res = await fetch(`/api/hr/employees/${id}`);
  if (!res.ok) throw new Error("Failed to fetch employee");
  return res.json();
}

export async function fetchEmployeeDocuments(id: string): Promise<EmployeeDocumentItem[]> {
  const res = await fetch(`/api/hr/employees/${id}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function fetchEmploymentHistory(id: string): Promise<EmploymentHistoryItem[]> {
  const res = await fetch(`/api/hr/employees/${id}/history`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}
```

- [ ] **Step 2: Create `services/departmentService.ts`**

```typescript
import type { DepartmentItem } from "@/lib/queries/departments";

export async function fetchDepartments(): Promise<DepartmentItem[]> {
  const res = await fetch("/api/hr/departments");
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}
```

- [ ] **Step 3: Create `services/positionService.ts`**

```typescript
import type { PositionItem } from "@/lib/queries/positions";

export async function fetchPositions(departmentId?: string): Promise<PositionItem[]> {
  const sp = departmentId ? `?departmentId=${departmentId}` : "";
  const res = await fetch(`/api/hr/positions${sp}`);
  if (!res.ok) throw new Error("Failed to fetch positions");
  return res.json();
}
```

- [ ] **Step 4: Create `hooks/useEmployees.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEmployees, fetchEmployeeById, fetchEmployeeDocuments, fetchEmploymentHistory } from "@/services/employeeService";
import { createEmployee, updateEmployee, deleteEmployee, uploadEmployeeDocument, deleteEmployeeDocument, addEmploymentHistory } from "@/actions/employee";

export function useEmployees(params: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  employmentType?: string;
}) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => fetchEmployees(params),
    staleTime: 60 * 1000,
  });
}

export function useEmployeeDetail(id: string) {
  return useQuery({
    queryKey: ["employees", id],
    queryFn: () => fetchEmployeeById(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useEmployeeDocuments(id: string) {
  return useQuery({
    queryKey: ["employees", id, "documents"],
    queryFn: () => fetchEmployeeDocuments(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useEmploymentHistory(id: string) {
  return useQuery({
    queryKey: ["employees", id, "history"],
    queryFn: () => fetchEmploymentHistory(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createEmployee>[0]) => createEmployee(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEmployee>[1] }) =>
      updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUploadEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, formData }: { profileId: string; formData: FormData }) =>
      uploadEmployeeDocument(profileId, formData),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employees", vars.profileId] }),
  });
}

export function useDeleteEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => deleteEmployeeDocument(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useAddEmploymentHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, data }: { profileId: string; data: Parameters<typeof addEmploymentHistory>[1] }) =>
      addEmploymentHistory(profileId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["employees", vars.profileId] }),
  });
}
```

- [ ] **Step 5: Create `hooks/useDepartments.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDepartments } from "@/services/departmentService";
import { createDepartment, updateDepartment, deleteDepartment } from "@/actions/department";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createDepartment>[0]) => createDepartment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateDepartment>[1] }) =>
      updateDepartment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}
```

- [ ] **Step 6: Create `hooks/usePositions.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPositions } from "@/services/positionService";
import { createPosition, updatePosition, deletePosition } from "@/actions/position";

export function usePositions(departmentId?: string) {
  return useQuery({
    queryKey: ["positions", departmentId],
    queryFn: () => fetchPositions(departmentId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createPosition>[0]) => createPosition(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePosition>[1] }) =>
      updatePosition(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePosition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });
}
```

- [ ] **Step 7: Add route meta entries to `lib/route-meta.ts`**

Find the existing HR entries and add after them:

```typescript
  "/dashboard/hr/database-karyawan": {
    title: "Database Karyawan",
    subtitle: "Kelola data karyawan perusahaan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/database-karyawan/[id]": {
    title: "Detail Karyawan",
    subtitle: "Informasi lengkap karyawan",
    parent: "/dashboard/hr/database-karyawan",
  },
```

- [ ] **Step 8: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add services/employeeService.ts services/departmentService.ts services/positionService.ts hooks/useEmployees.ts hooks/useDepartments.ts hooks/usePositions.ts lib/route-meta.ts
git commit -m "feat(hr): add services, hooks, and route meta for employee database"
```

---

### Task 8: Employee List Page + Table Component

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/page.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/EmployeesTable.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/EmployeeFilters.tsx`

This is the main employee list page. Build the server page component, the client table with pagination, and the filter bar. The page has top-level tabs: Karyawan | Departemen | Posisi | Org Chart — each tab renders the relevant content.

- [ ] **Step 1: Create `app/(private)/dashboard/hr/database-karyawan/page.tsx`**

Server component that checks permissions and renders the main client component.

```typescript
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { EmployeesTable } from "./_components/EmployeesTable";

export const metadata: Metadata = {
  title: "Database Karyawan - SWASANA",
  description: "Kelola data karyawan perusahaan",
};

export default async function DatabaseKaryawanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <EmployeesTable />
    </div>
  );
}
```

- [ ] **Step 2: Create `EmployeeFilters.tsx`**

A filter bar with search input, department dropdown, position dropdown, status dropdown, and employment type dropdown.

Build as a `"use client"` component that takes filter state as props and calls `onFilterChange` with the new filter values. Uses shadcn `Select`, `Input`, and `Button`. Follow the pattern from `AttendanceFilter.tsx` in the attendance module — controlled selects that fire onChange callbacks.

- [ ] **Step 3: Create `EmployeesTable.tsx`**

The main client component. Uses `useEmployees` hook for paginated data. Features:
- Tab bar at the top: Karyawan | Departemen | Posisi | Org Chart
- Search + filter bar (EmployeeFilters)
- Action buttons: "Tambah Karyawan" and "Export CSV"
- Table with columns: Employee#, Avatar+Name, Department, Position, Type, Status, Join Date, Actions
- Row actions: View Detail (link), Edit (drawer), Delete (confirm dialog)
- PaginationBar at bottom
- Loading skeleton state
- Empty state when no results
- EmployeeDrawer for create/edit

Uses `useDepartments()` and `usePositions()` for filter dropdown options. Permission-gated buttons via `PermissionGate`.

When the "Departemen" tab is active, render `DepartmentManager`. When "Posisi" tab is active, render `PositionManager`. When "Org Chart" tab is active, render `OrgChart`.

- [ ] **Step 4: Verify the page loads**

Run: `npm run dev`
Navigate to `/dashboard/hr/database-karyawan` in browser.
Expected: Page renders with empty employee table (or loading state).

- [ ] **Step 5: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/page.tsx" "app/(private)/dashboard/hr/database-karyawan/_components/EmployeesTable.tsx" "app/(private)/dashboard/hr/database-karyawan/_components/EmployeeFilters.tsx"
git commit -m "feat(hr): add employee list page with table, filters, pagination"
```

---

### Task 9: Employee Drawer (Create/Edit)

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/EmployeeDrawer.tsx`

- [ ] **Step 1: Create `EmployeeDrawer.tsx`**

A multi-step drawer for creating and editing employees. Uses the `Drawer` component from `@/components/shared/drawer`.

**Create mode:** Requires email, fullName, roleId at minimum. Shows all fields organized in sections (Personal, Employment, Payroll). Uses `useCreateEmployee()` mutation.

**Edit mode:** Populates from existing employee data. Uses `useUpdateEmployee()` mutation. Does NOT show email field (can't change email).

Form fields organized in collapsible sections:
- **Basic Info:** fullName, nickName, email (create only), phoneNumber, gender
- **Personal:** nik, kkNumber, placeOfBirth, dateOfBirth, religion, bloodType, maritalStatus, numberOfChildren, lastEducation, motherName
- **Address:** ktpAddress, currentAddress, city
- **Emergency:** emergencyContactName, emergencyContactRel, emergencyContactPhone
- **Employment:** departmentId (Select from departments), positionId (Select from positions), managerId (Select from employees), roleId (Select from roles), employmentType, joinDate, contractStartDate, contractEndDate, dataScope
- **Payroll:** bankName, bankAccountNumber, bankAccountHolder, npwp, bpjsKesehatan, bpjsKetenagakerjaan

Uses `useDepartments()`, `usePositions()` for dropdowns. Toast on success/error. Close drawer on success.

- [ ] **Step 2: Verify create and edit flows**

Run dev server, open drawer via "Tambah Karyawan" button, fill in required fields, submit.
Expected: Employee created, toast shown, drawer closes, table refreshes.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/_components/EmployeeDrawer.tsx"
git commit -m "feat(hr): add employee create/edit drawer component"
```

---

### Task 10: Employee Detail Page + Tabs

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/[id]/page.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/EmployeeDetailTabs.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/PersonalInfoSection.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/EmploymentSection.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/PayrollSection.tsx`

- [ ] **Step 1: Create detail page `[id]/page.tsx`**

```typescript
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { EmployeeDetailTabs } from "../_components/EmployeeDetailTabs";

export const metadata: Metadata = {
  title: "Detail Karyawan - SWASANA",
  description: "Informasi lengkap karyawan",
};

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("hr");
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <EmployeeDetailTabs employeeId={id} />
    </div>
  );
}
```

- [ ] **Step 2: Create `EmployeeDetailTabs.tsx`**

Client component that fetches employee detail via `useEmployeeDetail(employeeId)`. Shows:
- Header: avatar, fullName, employeeNumber badge, status badge, back button
- Tabs: Personal | Employment | Payroll | Documents | History
- Each tab renders the corresponding section component

Uses shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

- [ ] **Step 3: Create `PersonalInfoSection.tsx`**

Displays personal data in a card grid layout. Shows data as label-value pairs. Has an "Edit" button that toggles to inline form mode. On save, calls `useUpdateEmployee()` mutation with only the changed fields. On cancel, reverts to display mode.

Fields displayed: fullName, nickName, gender, placeOfBirth, dateOfBirth, nik, kkNumber, motherName, religion, bloodType, maritalStatus, numberOfChildren, lastEducation, phoneNumber, email, ktpAddress, currentAddress, city, emergencyContactName, emergencyContactRel, emergencyContactPhone.

- [ ] **Step 4: Create `EmploymentSection.tsx`**

Same pattern as PersonalInfoSection. Displays: employeeNumber, department, position, manager, role, dataScope, employmentType, status, joinDate, resignDate, contractStartDate, contractEndDate. Department/position/manager show as links or names. Edit mode uses Select dropdowns for department, position, manager, role, employmentType, dataScope, status.

- [ ] **Step 5: Create `PayrollSection.tsx`**

Same pattern. Displays: bankName, bankAccountNumber, bankAccountHolder, npwp, bpjsKesehatan, bpjsKetenagakerjaan. All text inputs in edit mode.

- [ ] **Step 6: Verify detail page navigation and tabs**

From the employee list, click "View Detail" on a row. Expected: navigates to `/dashboard/hr/database-karyawan/[id]`, shows header and tabs with data. Switch between tabs. Click "Edit" on a section, modify a field, save.

- [ ] **Step 7: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/[id]/" "app/(private)/dashboard/hr/database-karyawan/_components/EmployeeDetailTabs.tsx" "app/(private)/dashboard/hr/database-karyawan/_components/PersonalInfoSection.tsx" "app/(private)/dashboard/hr/database-karyawan/_components/EmploymentSection.tsx" "app/(private)/dashboard/hr/database-karyawan/_components/PayrollSection.tsx"
git commit -m "feat(hr): add employee detail page with personal, employment, payroll tabs"
```

---

### Task 11: Documents Section

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/DocumentsSection.tsx`
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/DocumentUploadModal.tsx`

- [ ] **Step 1: Create `DocumentUploadModal.tsx`**

A dialog for uploading employee documents. Uses shadcn `Dialog`. Fields:
- Document type: Select from [KTP, NPWP, BPJS Kesehatan, BPJS TK, Kontrak, Ijazah, Sertifikat, Lainnya]
- Document name: Input (auto-filled from file name)
- Expiry date: Date picker (optional)
- File: File input with drag-drop zone, max 10MB, accepts PDF/images

On submit, creates FormData and calls `useUploadEmployeeDocument()` mutation. Shows upload progress. Toast on success/error.

- [ ] **Step 2: Create `DocumentsSection.tsx`**

Tab content for documents. Uses `useEmployeeDocuments(employeeId)` for data. Shows:
- "Upload Dokumen" button (opens DocumentUploadModal)
- Table/card list of documents: type badge, filename, file size (formatted), expiry date, upload date, uploader name
- Row actions: Preview (opens in new tab for images, downloads for PDFs), Delete (confirm dialog)
- Empty state when no documents

Delete uses `useDeleteEmployeeDocument()` mutation with confirmation dialog.

- [ ] **Step 3: Verify document upload and listing**

Navigate to employee detail → Documents tab. Upload a test document. Verify it appears in the list. Delete it.

- [ ] **Step 4: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/_components/DocumentsSection.tsx" "app/(private)/dashboard/hr/database-karyawan/_components/DocumentUploadModal.tsx"
git commit -m "feat(hr): add employee document upload and management"
```

---

### Task 12: History Section

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/HistorySection.tsx`

- [ ] **Step 1: Create `HistorySection.tsx`**

Tab content for employment history. Uses `useEmploymentHistory(employeeId)` for data. Shows:
- "Tambah Riwayat" button that opens a dialog with: changeType (Select), description (Textarea), oldValue (Input, optional), newValue (Input, optional), effectiveDate (Date picker)
- Timeline view: vertical line with dots for each entry. Each entry shows: effectiveDate, changeType badge, description, old → new value, created by name
- Change type badges use muted colors from the design system (no hardcoded colors)
- Empty state when no history

"Tambah Riwayat" submits via `useAddEmploymentHistory()` mutation.

- [ ] **Step 2: Verify history display and manual entry**

Navigate to employee detail → History tab. If employee was just created, should show "join" entry. Click "Tambah Riwayat", add a manual entry. Verify it appears in timeline.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/_components/HistorySection.tsx"
git commit -m "feat(hr): add employment history timeline with manual entry"
```

---

### Task 13: Department Manager

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/DepartmentManager.tsx`

- [ ] **Step 1: Create `DepartmentManager.tsx`**

Rendered when "Departemen" tab is active in the employee list page. Uses `useDepartments()` for data.

Shows a tree view of departments with hierarchy (parent-child nesting). Each node displays: department name, head name (or "Belum ditentukan"), employee count badge, child count.

Actions (permission-gated):
- "Tambah Departemen" button: opens dialog with name, description, parent department (Select), head (employee autocomplete Select)
- Edit button per node: opens same dialog pre-filled
- Delete button per node: confirm dialog, blocked if department has employees (shows error message)

Tree rendering: recursively render children indented under parents. Root departments (parentId = null) at top level. Use `useMemo` to build tree structure from flat array.

Uses `useCreateDepartment()`, `useUpdateDepartment()`, `useDeleteDepartment()` mutations.

- [ ] **Step 2: Verify department CRUD**

Switch to "Departemen" tab. Create a department. Create a child department. Edit the parent. Try to delete a department with employees (should fail with message). Delete empty department.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/_components/DepartmentManager.tsx"
git commit -m "feat(hr): add department management with tree hierarchy"
```

---

### Task 14: Position Manager

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/PositionManager.tsx`

- [ ] **Step 1: Create `PositionManager.tsx`**

Rendered when "Posisi" tab is active. Uses `usePositions()` for data.

Table with columns: Name, Department, Level, Employee Count, Actions. Filter by department dropdown at the top.

Actions (permission-gated):
- "Tambah Posisi" button: dialog with name, department (optional Select), level (number input)
- Edit button per row: pre-filled dialog
- Delete button per row: confirm dialog, blocked if position has employees

Uses `useCreatePosition()`, `useUpdatePosition()`, `useDeletePosition()` mutations.

- [ ] **Step 2: Verify position CRUD**

Switch to "Posisi" tab. Create a position. Assign it to a department. Edit it. Delete it.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/_components/PositionManager.tsx"
git commit -m "feat(hr): add position management table"
```

---

### Task 15: Org Chart

**Files:**
- Create: `app/(private)/dashboard/hr/database-karyawan/_components/OrgChart.tsx`

- [ ] **Step 1: Create `OrgChart.tsx`**

Rendered when "Org Chart" tab is active. Fetches employees with their manager relationships via a dedicated query.

Uses `useEmployees({ limit: 500 })` to get all employees, then builds a tree based on `managerId` relationships:
1. Find root nodes (employees with no manager or whose manager is not in the list)
2. Recursively attach subordinates to each node
3. Render as a CSS tree with horizontal/vertical connectors

Each node is a card showing: avatar (or initials), name, position name, department name. Click navigates to `/dashboard/hr/database-karyawan/[id]`.

CSS tree layout: uses flexbox with pseudo-elements for connector lines. No external library needed. Supports expand/collapse of branches (local state).

- [ ] **Step 2: Verify org chart renders**

Switch to "Org Chart" tab. Should see tree of employees with manager hierarchy. Click on a node to navigate to detail page.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/hr/database-karyawan/_components/OrgChart.tsx"
git commit -m "feat(hr): add organization chart visualization"
```

---

### Task 16: Final Verification + Cleanup

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npx next lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual testing checklist**

Navigate through these flows in the browser:

1. `/dashboard/hr/database-karyawan` — Employee list page loads
2. Search by name — results filter
3. Filter by department/status — results filter
4. Click "Tambah Karyawan" — drawer opens, fill in fields, submit
5. Click "View Detail" on a row — navigates to detail page
6. Personal tab — data displays, edit inline works
7. Employment tab — data displays, edit inline works, auto-creates history entry on change
8. Payroll tab — data displays, edit works
9. Documents tab — upload a document, list shows, delete works
10. History tab — timeline shows, manual entry works
11. Back to list → "Departemen" tab — tree renders, CRUD works
12. "Posisi" tab — table renders, CRUD works
13. "Org Chart" tab — tree renders, click navigates
14. "Export" button — downloads CSV file
15. Delete employee (soft) — status changes to inactive

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(hr): complete Database Karyawan module — employee CRUD, detail, documents, history, departments, positions, org chart"
```
