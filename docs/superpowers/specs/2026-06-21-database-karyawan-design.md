# Database Karyawan (Employee Database) — Design Spec

**Date:** 2026-06-21
**Module:** HR & Payroll — Phase 2
**Status:** Approved
**Prerequisite:** Attendance module (Phase 1) — complete

---

## 1. Overview

Full-featured employee database management module. Enhances the existing Profile model with employment-specific fields and adds supporting models for Department, Position, EmployeeDocument, and EmploymentHistory. Provides CRUD UI for employee management, document uploads, org chart visualization, and department/position reference data management.

## 2. Data Model

### 2.1 Profile Enhancement

Add these fields to the existing `Profile` model:

| Field | Type | Default | Notes |
|---|---|---|---|
| `npwp` | String? | null | Tax ID |
| `bpjsKesehatan` | String? | null | BPJS Health number |
| `bpjsKetenagakerjaan` | String? | null | BPJS Employment number |
| `religion` | Religion? | null | Enum |
| `bloodType` | String? | null | A, B, AB, O |
| `joinDate` | DateTime? | null | Employment start date |
| `resignDate` | DateTime? | null | Null if active |
| `employmentType` | EmploymentType? | null | permanent/contract/probation/intern |
| `contractStartDate` | DateTime? | null | |
| `contractEndDate` | DateTime? | null | |
| `departmentId` | String? | null | FK to Department |
| `positionId` | String? | null | FK to Position |

### 2.2 New Enums

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

### 2.3 Department Model

```prisma
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

Hierarchy supports nested departments (e.g., Engineering > Backend > API Team). `headId` points to the department head's Profile.

### 2.4 Position Model

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

Position can optionally belong to a department. `level` indicates seniority (0 = entry, higher = senior).

### 2.5 EmployeeDocument Model

```prisma
model EmployeeDocument {
  id          String    @id @default(uuid())
  profileId   String
  type        String    // ktp, npwp, bpjs_kes, bpjs_tk, contract, ijazah, certificate, other
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

R2 key format: `employees/{profileId}/documents/{type}-{timestamp}.{ext}`

### 2.6 EmploymentHistory Model

```prisma
model EmploymentHistory {
  id            String   @id @default(uuid())
  profileId     String
  changeType    String   // promotion, transfer, demotion, status_change, contract_renewal, salary_change, join, resign
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

Records are auto-created when key fields change (department, position, status, employment type) and manually creatable by HR.

---

## 3. Pages & UI

### 3.1 Employee List Page

**Route:** `/dashboard/hr/database-karyawan`
**Permission:** `hr:view` (own department), `hr:view-all` (all employees)

**Layout:**
- Page header with title "Database Karyawan" and subtitle
- Action bar: search input, filter dropdowns, "Tambah Karyawan" button, "Export" button
- Table with columns: Employee#, Avatar+Name, Department, Position, Employment Type, Status, Join Date, Actions
- Pagination (50 rows per page)
- Empty state when no employees match filters

**Filters:**
- Department (dropdown, multi-select)
- Position (dropdown)
- Status (active, inactive, suspended)
- Employment Type (permanent, contract, probation, intern)
- Search: name, NIK, employee number

**Actions per row:**
- View Detail (navigates to `/dashboard/hr/database-karyawan/[id]`)
- Edit (opens drawer)
- Delete (confirmation dialog, soft-delete = set status inactive)

### 3.2 Employee Detail Page

**Route:** `/dashboard/hr/database-karyawan/[id]`
**Permission:** `hr:view` (own profile or managed employees), `hr:view-all` (any)

**Layout:** Header with avatar, name, employee number, status badge. Tabbed content below:

**Tab 1 — Personal:**
- Nama lengkap, nama panggilan, gender, tempat & tanggal lahir
- NIK, nomor KK, ibu kandung
- Agama, golongan darah, status perkawinan, jumlah anak
- Pendidikan terakhir
- Alamat KTP, alamat domisili, kota
- Kontak darurat (nama, hubungan, telepon)
- Phone number, email

**Tab 2 — Employment:**
- Employee number, department, position, manager
- Employment type, status
- Tanggal masuk, tanggal resign
- Kontrak start/end dates
- Role & data scope

**Tab 3 — Payroll Info:**
- Bank name, account number, account holder
- NPWP
- BPJS Kesehatan, BPJS Ketenagakerjaan

**Tab 4 — Documents:**
- Upload area (drag & drop atau browse)
- Document type selector (KTP, NPWP, BPJS Kesehatan, BPJS TK, Kontrak, Ijazah, Sertifikat, Lainnya)
- List of uploaded documents with: type badge, filename, file size, expiry date, upload date, download/delete actions
- Preview modal for images, download for PDFs

**Tab 5 — History:**
- Timeline view of employment changes
- Each entry: date, change type badge, description, old → new value, created by
- "Add Entry" button for HR to manually add history records

**Edit Mode:**
- Each section has an "Edit" button
- Opens inline form within the section (not a separate page)
- Save/Cancel buttons
- Validation with Zod
- Auto-creates EmploymentHistory record when key fields change

### 3.3 Department Management

**Route:** `/dashboard/hr/database-karyawan` (sub-tab or separate sub-route)
**Placement:** Tab "Departemen" in the employee list page, or accessible via sidebar sub-item
**Permission:** `hr-departments:view/create/edit/delete`

**UI:**
- Tree view showing department hierarchy (parent-child nesting)
- Each node shows: department name, head name, employee count
- Add/Edit dialog: name, description, parent department, head (employee autocomplete)
- Delete with confirmation (blocked if department has employees)
- Drag-drop reorder

### 3.4 Position Management

**Route:** Same page as departments, separate tab
**Permission:** `hr-positions:view/create/edit/delete`

**UI:**
- Table: name, department, level, employee count
- Filter by department
- Add/Edit dialog: name, department (optional), level
- Delete with confirmation (blocked if position has employees)

### 3.5 Org Chart

**Route:** Sub-tab in Database Karyawan page
**Permission:** `hr:view`

**UI:**
- Tree visualization of company hierarchy
- Based on Department hierarchy + managerId relationships
- Each node: avatar, name, position, department
- Click to navigate to employee detail
- Expand/collapse branches
- Simple implementation — CSS tree, no external library needed

---

## 4. API Layer

### 4.1 Employee API Routes

| Method | Path | Permission | Rate Limit |
|---|---|---|---|
| GET | `/api/hr/employees` | `hr:view` / `hr:view-all` | apiLimiter |
| GET | `/api/hr/employees/[id]` | `hr:view` / `hr:view-all` | apiLimiter |
| GET | `/api/hr/employees/export` | `hr:export` | apiLimiter |

### 4.2 Employee Server Actions

| Action | Permission | Rate Limit |
|---|---|---|
| `createEmployee` | `hr:create` | mutationLimiter |
| `updateEmployee` | `hr:edit` | mutationLimiter |
| `deleteEmployee` | `hr:delete` | mutationLimiter |
| `uploadEmployeeDocument` | `hr:edit` | mutationLimiter |
| `deleteEmployeeDocument` | `hr:edit` | mutationLimiter |
| `addEmploymentHistory` | `hr:edit` | mutationLimiter |

### 4.3 Department API Routes & Actions

| Method/Action | Path/Name | Permission |
|---|---|---|
| GET | `/api/hr/departments` | `hr-departments:view` |
| `createDepartment` | action | `hr-departments:create` |
| `updateDepartment` | action | `hr-departments:edit` |
| `deleteDepartment` | action | `hr-departments:delete` |

### 4.4 Position API Routes & Actions

| Method/Action | Path/Name | Permission |
|---|---|---|
| GET | `/api/hr/positions` | `hr-positions:view` |
| `createPosition` | action | `hr-positions:create` |
| `updatePosition` | action | `hr-positions:edit` |
| `deletePosition` | action | `hr-positions:delete` |

### 4.5 Security — All Endpoints

1. `requirePermissionForRoute()` or `requirePermission()` first
2. Rate limiter (apiLimiter for GET, mutationLimiter for CUD)
3. Zod validation on all inputs
4. `db.$transaction([...])` (array form) for multi-table writes
5. `logAudit()` for every CUD operation
6. `revalidateTag()` after mutations
7. No internal error leakage — generic error messages only

---

## 5. Validation Schemas

### 5.1 Employee Schemas (`lib/validations/employee.ts`)

```typescript
const createEmployeeSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
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
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
  joinDate: z.coerce.date().optional(),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
});
```

### 5.2 Department Schemas (`lib/validations/department.ts`)

```typescript
const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  headId: z.string().optional(),
  sortOrder: z.number().int().optional(),
});
```

### 5.3 Position Schemas (`lib/validations/position.ts`)

```typescript
const createPositionSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().optional(),
  level: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
});
```

---

## 6. Permissions

### 6.1 New Permission Entries (seed via migration)

```sql
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  -- HR Employee Management
  (gen_random_uuid()::text, 'hr', 'create', 'Create employees', 20),
  (gen_random_uuid()::text, 'hr', 'edit', 'Edit employees', 20),
  (gen_random_uuid()::text, 'hr', 'delete', 'Delete employees', 20),
  (gen_random_uuid()::text, 'hr', 'export', 'Export employee data', 20),
  -- HR Departments
  (gen_random_uuid()::text, 'hr-departments', 'view', 'View departments', 21),
  (gen_random_uuid()::text, 'hr-departments', 'create', 'Create departments', 21),
  (gen_random_uuid()::text, 'hr-departments', 'edit', 'Edit departments', 21),
  (gen_random_uuid()::text, 'hr-departments', 'delete', 'Delete departments', 21),
  -- HR Positions
  (gen_random_uuid()::text, 'hr-positions', 'view', 'View positions', 22),
  (gen_random_uuid()::text, 'hr-positions', 'create', 'Create positions', 22),
  (gen_random_uuid()::text, 'hr-positions', 'edit', 'Edit positions', 22),
  (gen_random_uuid()::text, 'hr-positions', 'delete', 'Delete positions', 22)
ON CONFLICT (module, action) DO NOTHING;
```

### 6.2 Route Meta Entries

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

---

## 7. File Structure

```
app/(private)/dashboard/hr/database-karyawan/
├── page.tsx                          # Employee list (server component)
├── [id]/
│   └── page.tsx                      # Employee detail (server component)
└── _components/
    ├── EmployeesTable.tsx             # Main table with search/filter/pagination
    ├── EmployeeDrawer.tsx             # Create/Edit employee drawer
    ├── EmployeeFilters.tsx            # Filter bar (department, position, status, type)
    ├── EmployeeDetailTabs.tsx         # Tabbed detail view container
    ├── PersonalInfoSection.tsx        # Tab 1: personal data
    ├── EmploymentSection.tsx          # Tab 2: employment data
    ├── PayrollSection.tsx             # Tab 3: payroll/bank/BPJS
    ├── DocumentsSection.tsx           # Tab 4: document management
    ├── HistorySection.tsx             # Tab 5: employment history timeline
    ├── DepartmentManager.tsx          # Department CRUD (tree view)
    ├── PositionManager.tsx            # Position CRUD (table)
    ├── OrgChart.tsx                   # Organization chart visualization
    └── DocumentUploadModal.tsx        # File upload dialog

lib/queries/employees.ts              # getEmployees, getEmployeeById, getEmployeeDocuments
lib/queries/departments.ts            # getDepartments, getDepartmentTree
lib/queries/positions.ts              # getPositions
lib/validations/employee.ts           # Zod schemas
lib/validations/department.ts
lib/validations/position.ts
actions/employee.ts                   # createEmployee, updateEmployee, deleteEmployee, uploadDoc, addHistory
actions/department.ts                 # CRUD
actions/position.ts                   # CRUD
hooks/useEmployees.ts                 # TanStack Query hooks
hooks/useDepartments.ts
hooks/usePositions.ts
services/employeeService.ts           # Client fetch wrappers
services/departmentService.ts
services/positionService.ts
app/api/hr/employees/route.ts         # GET list
app/api/hr/employees/[id]/route.ts    # GET detail
app/api/hr/employees/export/route.ts  # GET CSV export
app/api/hr/departments/route.ts       # GET list
app/api/hr/positions/route.ts         # GET list
```

---

## 8. Migration Strategy

Single migration file: `prisma/migrations/<timestamp>_add_employee_database/migration.sql`

Contents:
1. Add new enums (Religion, EmploymentType)
2. Add new columns to `profiles` table
3. Create `departments` table
4. Create `positions` table
5. Create `employee_documents` table
6. Create `employment_histories` table
7. Add foreign keys + indexes
8. Seed permissions (INSERT ... ON CONFLICT DO NOTHING)

All statements use `IF NOT EXISTS` / `IF EXISTS` for idempotency.

---

## 9. Key Design Decisions

1. **Profile as employee master** — no separate Employee model. Profile already has employeeNumber, personal data, and payroll fields. Adding department/position/employment fields directly avoids redundancy and sync issues.

2. **Department hierarchy** — self-referential `parentId` on Department model. Supports arbitrary depth. headId points to department head's Profile.

3. **Soft delete for employees** — setting `status = inactive` instead of hard delete. Preserves audit trail, attendance records, and referential integrity.

4. **Document storage on R2** — same infrastructure as attendance photos. Key format ensures organized storage per employee.

5. **Auto history tracking** — when key fields change (department, position, status, employment type), an EmploymentHistory record is auto-created in the same transaction as the update.

6. **Org chart from managerId** — uses existing Profile.managerId relationship, not a separate hierarchy table. Department hierarchy is additive context, not a replacement.

7. **createEmployee reuses invite flow** — "Tambah Karyawan" creates User + Profile via the same mechanism as `inviteUser` (from `actions/user.ts`), but with additional HR-specific fields (department, position, employment type, join date, etc.). The employee receives an invite email to set up their password. The `createEmployee` action wraps this flow rather than duplicating it.

8. **Delete protection** — departments and positions cannot be deleted if they have assigned employees. The UI shows an error message instructing the user to reassign employees first.
