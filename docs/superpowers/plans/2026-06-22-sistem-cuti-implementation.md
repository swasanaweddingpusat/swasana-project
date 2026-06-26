# Sistem Cuti (Leave Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full leave management system with leave types (preset UU + custom), per-employee annual balances with prorate, dual approval (Manager → HR), attendance integration (auto-create `on_leave` records), and team calendar.

**Architecture:** Add 3 Prisma models (LeaveType, LeaveBalance, LeaveRequest) + enum. Leave business logic (weekday counting, balance checking, attendance record creation) lives in `lib/leave-helpers.ts`. Dual approval uses Profile.managerId for step 1 and `hr-leave:approve` permission for step 2. Single page `/dashboard/hr/sistem-cuti` serves both employee and admin views differentiated by permissions.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Neon HTTP adapter), Zod v4, TanStack Query v5, shadcn v4 + Tailwind v4, Solar Icons BoldDuotone.

**Spec:** `docs/superpowers/specs/2026-06-22-sistem-cuti-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `prisma/migrations/20260622140000_add_leave_management/migration.sql` | Schema migration + preset seeds + permission seeds |
| `lib/leave-helpers.ts` | countWeekdays, calculateProrate, getAvailableBalance |
| `lib/validations/leaveType.ts` | Zod schemas for leave type CRUD |
| `lib/validations/leaveRequest.ts` | Zod schemas for submit, approve, reject, cancel |
| `lib/validations/leaveBalance.ts` | Zod schemas for generate balances, adjust |
| `lib/queries/leaveTypes.ts` | getLeaveTypes |
| `lib/queries/leaveBalances.ts` | getLeaveBalances |
| `lib/queries/leaveRequests.ts` | getLeaveRequests, getMyLeaveRequests, getPendingForManager, getLeaveCalendar |
| `actions/leaveType.ts` | CRUD leave types |
| `actions/leaveRequest.ts` | submit, managerApprove/Reject, hrApprove/Reject, cancel |
| `actions/leaveBalance.ts` | generateBalances, adjustBalance |
| `services/leave-type-service.ts` | Client fetch wrapper |
| `services/leave-request-service.ts` | Client fetch wrappers |
| `services/leave-balance-service.ts` | Client fetch wrapper |
| `hooks/use-leave-types.ts` | TanStack Query hooks |
| `hooks/use-leave-requests.ts` | TanStack Query hooks |
| `hooks/use-leave-balances.ts` | TanStack Query hooks |
| `app/api/hr/leave-types/route.ts` | GET leave types |
| `app/api/hr/leave-balances/route.ts` | GET leave balances |
| `app/api/hr/leave-requests/route.ts` | GET all leave requests (admin) |
| `app/api/hr/leave-requests/my/route.ts` | GET my leave requests |
| `app/api/hr/leave-requests/pending/route.ts` | GET pending requests for manager |
| `app/api/hr/leave-calendar/route.ts` | GET calendar data |
| `app/(private)/dashboard/hr/sistem-cuti/page.tsx` | Server component page |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveManagement.tsx` | Tab wrapper (employee + admin views) |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveBalanceCards.tsx` | Balance display cards |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveRequestForm.tsx` | Submit leave request form |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveRequestHistory.tsx` | My request history table |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTeamCalendar.tsx` | Team calendar view |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveApprovalTable.tsx` | Pending approval table (manager/HR) |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTypeManager.tsx` | Leave type CRUD table + dialog |
| `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveBalanceManager.tsx` | Balance table + generate + adjust |

### Modified Files

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add LeaveType, LeaveBalance, LeaveRequest models, LeaveRequestStatus enum, add `on_leave` to AttendanceStatus, add Profile relations |
| `lib/route-meta.ts` | Add `/dashboard/hr/sistem-cuti` entry |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260622140000_add_leave_management/migration.sql`

- [ ] **Step 1: Add `on_leave` to AttendanceStatus enum**

In `prisma/schema.prisma`, find the `AttendanceStatus` enum (line ~569) and add `on_leave`:

```prisma
enum AttendanceStatus {
  on_time
  late
  absent
  on_leave
}
```

- [ ] **Step 2: Add LeaveRequestStatus enum**

After the `AttendanceStatus` enum, add:

```prisma
enum LeaveRequestStatus {
  pending
  manager_approved
  approved
  rejected
  cancelled
}
```

- [ ] **Step 3: Add LeaveType model**

After the ShiftOverride model (end of attendance enhancement section), add:

```prisma
// ─── Leave Management ────────────────────────────────────────────────────────

model LeaveType {
  id                    String    @id @default(uuid())
  name                  String    @unique
  code                  String    @unique
  description           String?
  defaultQuota          Int       @default(0)
  isDeductible          Boolean   @default(true)
  requiresApproval      Boolean   @default(true)
  maxConsecutiveDays    Int?
  minDaysBeforeRequest  Int       @default(0)
  isCarryOver           Boolean   @default(false)
  carryOverMaxDays      Int?
  carryOverExpiryMonths Int?
  isActive              Boolean   @default(true)
  isSystemType          Boolean   @default(false)
  sortOrder             Int       @default(0)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  balances              LeaveBalance[]
  requests              LeaveRequest[]

  @@map("leave_types")
}
```

- [ ] **Step 4: Add LeaveBalance model**

```prisma
model LeaveBalance {
  id             String    @id @default(uuid())
  profileId      String
  leaveTypeId    String
  year           Int
  totalDays      Int       @default(0)
  usedDays       Int       @default(0)
  carryOverDays  Int       @default(0)
  adjustmentDays Int       @default(0)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  profile        Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  leaveType      LeaveType @relation(fields: [leaveTypeId], references: [id], onDelete: Cascade)

  @@unique([profileId, leaveTypeId, year])
  @@index([profileId])
  @@index([leaveTypeId])
  @@index([year])
  @@map("leave_balances")
}
```

- [ ] **Step 5: Add LeaveRequest model**

```prisma
model LeaveRequest {
  id                 String              @id @default(uuid())
  profileId          String
  leaveTypeId        String
  startDate          DateTime
  endDate            DateTime
  totalDays          Int
  reason             String?
  status             LeaveRequestStatus  @default(pending)

  managerApprovedBy  String?
  managerApprovedAt  DateTime?
  managerNote        String?

  hrApprovedBy       String?
  hrApprovedAt       DateTime?
  hrNote             String?

  rejectedBy         String?
  rejectedAt         DateTime?
  rejectionReason    String?

  cancelledAt        DateTime?
  cancellationReason String?

  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  profile            Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)
  leaveType          LeaveType           @relation(fields: [leaveTypeId], references: [id], onDelete: Cascade)
  managerApprover    Profile?            @relation("LeaveManagerApprover", fields: [managerApprovedBy], references: [id], onDelete: SetNull)
  hrApprover         Profile?            @relation("LeaveHrApprover", fields: [hrApprovedBy], references: [id], onDelete: SetNull)
  rejector           Profile?            @relation("LeaveRejector", fields: [rejectedBy], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([leaveTypeId])
  @@index([status])
  @@index([startDate])
  @@index([endDate])
  @@map("leave_requests")
}
```

- [ ] **Step 6: Add Profile reverse relations**

Add after the `shiftOverridesCreated` line (line ~176 in schema), before `@@index([roleId])`:

```prisma
  leaveBalances             LeaveBalance[]
  leaveRequests             LeaveRequest[]
  leaveManagerApprovals     LeaveRequest[]  @relation("LeaveManagerApprover")
  leaveHrApprovals          LeaveRequest[]  @relation("LeaveHrApprover")
  leaveRejections           LeaveRequest[]  @relation("LeaveRejector")
```

- [ ] **Step 7: Create migration SQL**

Create `prisma/migrations/20260622140000_add_leave_management/migration.sql`:

```sql
-- Add on_leave to AttendanceStatus enum
DO $$ BEGIN
  ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'on_leave';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: LeaveRequestStatus
DO $$ BEGIN
  CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'manager_approved', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: leave_types
CREATE TABLE IF NOT EXISTS "leave_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "defaultQuota" INTEGER NOT NULL DEFAULT 0,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxConsecutiveDays" INTEGER,
    "minDaysBeforeRequest" INTEGER NOT NULL DEFAULT 0,
    "isCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "carryOverMaxDays" INTEGER,
    "carryOverExpiryMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystemType" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_name_key" ON "leave_types"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_code_key" ON "leave_types"("code");

-- CreateTable: leave_balances
CREATE TABLE IF NOT EXISTS "leave_balances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "usedDays" INTEGER NOT NULL DEFAULT 0,
    "carryOverDays" INTEGER NOT NULL DEFAULT 0,
    "adjustmentDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_profileId_leaveTypeId_year_key" ON "leave_balances"("profileId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "leave_balances_profileId_idx" ON "leave_balances"("profileId");
CREATE INDEX IF NOT EXISTS "leave_balances_leaveTypeId_idx" ON "leave_balances"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "leave_balances_year_idx" ON "leave_balances"("year");

-- CreateTable: leave_requests
CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "managerNote" TEXT,
    "hrApprovedBy" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrNote" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_requests_profileId_idx" ON "leave_requests"("profileId");
CREATE INDEX IF NOT EXISTS "leave_requests_leaveTypeId_idx" ON "leave_requests"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX IF NOT EXISTS "leave_requests_startDate_idx" ON "leave_requests"("startDate");
CREATE INDEX IF NOT EXISTS "leave_requests_endDate_idx" ON "leave_requests"("endDate");

-- AddForeignKeys: leave_balances
DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKeys: leave_requests
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_managerApprovedBy_fkey" FOREIGN KEY ("managerApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hrApprovedBy_fkey" FOREIGN KEY ("hrApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed preset leave types
INSERT INTO "leave_types" (id, name, code, description, "defaultQuota", "isDeductible", "requiresApproval", "maxConsecutiveDays", "minDaysBeforeRequest", "isCarryOver", "carryOverMaxDays", "isActive", "isSystemType", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Cuti Tahunan', 'annual', 'Cuti tahunan sesuai UU Ketenagakerjaan', 12, true, true, NULL, 3, true, 6, true, true, 1, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Sakit', 'sick', 'Cuti sakit dengan surat dokter', 14, true, true, NULL, 0, false, NULL, true, true, 2, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Melahirkan', 'maternity', 'Cuti melahirkan 3 bulan', 90, false, true, 90, 14, false, NULL, true, true, 3, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Ayah', 'paternity', 'Cuti kelahiran anak untuk ayah', 2, false, true, 2, 0, false, NULL, true, true, 4, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Menikah', 'marriage', 'Cuti pernikahan karyawan', 3, false, true, 3, 7, false, NULL, true, true, 5, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Keluarga Meninggal', 'bereavement', 'Cuti duka keluarga meninggal', 2, false, true, 2, 0, false, NULL, true, true, 6, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Ibadah Keagamaan', 'religious', 'Cuti ibadah sesuai kebutuhan', 0, false, true, NULL, 7, false, NULL, true, true, 7, NOW(), NOW()),
  (gen_random_uuid()::text, 'Cuti Tanpa Gaji', 'unpaid', 'Cuti tanpa gaji', 0, false, true, NULL, 7, false, NULL, true, true, 8, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Seed permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-leave', 'view', 'View leave types, balances, requests', 23),
  (gen_random_uuid()::text, 'hr-leave', 'create', 'Create leave types, generate balances', 23),
  (gen_random_uuid()::text, 'hr-leave', 'edit', 'Edit leave types, adjust balances', 23),
  (gen_random_uuid()::text, 'hr-leave', 'delete', 'Delete custom leave types', 23),
  (gen_random_uuid()::text, 'hr-leave', 'approve', 'Approve/reject leave requests (HR level)', 23)
ON CONFLICT (module, action) DO NOTHING;
```

- [ ] **Step 8: Validate and generate Prisma client**

Run: `npx prisma validate` then `npx prisma generate`

---

### Task 2: Leave Helpers + Validation Schemas

**Files:**
- Create: `lib/leave-helpers.ts`
- Create: `lib/validations/leaveType.ts`
- Create: `lib/validations/leaveRequest.ts`
- Create: `lib/validations/leaveBalance.ts`

- [ ] **Step 1: Create `lib/leave-helpers.ts`**

```typescript
export function countWeekdays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function calculateProrate(joinDate: Date, year: number, defaultQuota: number): number {
  const joinYear = joinDate.getFullYear();
  if (joinYear < year) return defaultQuota;
  if (joinYear > year) return 0;
  const joinMonth = joinDate.getMonth() + 1;
  const remainingMonths = 12 - joinMonth + 1;
  return Math.ceil((remainingMonths / 12) * defaultQuota);
}

export function getAvailableBalance(balance: { totalDays: number; usedDays: number; carryOverDays: number; adjustmentDays: number }): number {
  return balance.totalDays + balance.carryOverDays + balance.adjustmentDays - balance.usedDays;
}

export function getWeekdaysBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
```

- [ ] **Step 2: Create `lib/validations/leaveType.ts`**

```typescript
import { z } from "zod";

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1, "Nama jenis cuti wajib diisi"),
  code: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Code harus lowercase alphanumeric"),
  description: z.string().optional(),
  defaultQuota: z.number().int().min(0).default(0),
  isDeductible: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  maxConsecutiveDays: z.number().int().min(1).optional(),
  minDaysBeforeRequest: z.number().int().min(0).default(0),
  isCarryOver: z.boolean().default(false),
  carryOverMaxDays: z.number().int().min(1).optional(),
  carryOverExpiryMonths: z.number().int().min(1).max(12).optional(),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
```

- [ ] **Step 3: Create `lib/validations/leaveRequest.ts`**

```typescript
import { z } from "zod";

export const submitLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Jenis cuti wajib dipilih"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export const approveLeaveSchema = z.object({
  requestId: z.string().min(1),
  note: z.string().optional(),
});

export const rejectLeaveSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

export const cancelLeaveSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().optional(),
});

export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>;
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>;
export type CancelLeaveInput = z.infer<typeof cancelLeaveSchema>;
```

- [ ] **Step 4: Create `lib/validations/leaveBalance.ts`**

```typescript
import { z } from "zod";

export const generateBalancesSchema = z.object({
  year: z.number().int().min(2020).max(2100),
});

export const adjustBalanceSchema = z.object({
  balanceId: z.string().min(1),
  adjustmentDays: z.number().int(),
  reason: z.string().min(1, "Alasan adjustment wajib diisi"),
});

export type GenerateBalancesInput = z.infer<typeof generateBalancesSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 3: Database Queries

**Files:**
- Create: `lib/queries/leaveTypes.ts`
- Create: `lib/queries/leaveBalances.ts`
- Create: `lib/queries/leaveRequests.ts`

- [ ] **Step 1: Create `lib/queries/leaveTypes.ts`**

```typescript
import { db } from "@/lib/db";

export async function getLeaveTypes() {
  return db.leaveType.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, code: true, description: true,
      defaultQuota: true, isDeductible: true, requiresApproval: true,
      maxConsecutiveDays: true, minDaysBeforeRequest: true,
      isCarryOver: true, carryOverMaxDays: true, carryOverExpiryMonths: true,
      isActive: true, isSystemType: true, sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
    take: 100,
  });
}

export async function getAllLeaveTypes() {
  return db.leaveType.findMany({
    select: {
      id: true, name: true, code: true, description: true,
      defaultQuota: true, isDeductible: true, requiresApproval: true,
      maxConsecutiveDays: true, minDaysBeforeRequest: true,
      isCarryOver: true, carryOverMaxDays: true, carryOverExpiryMonths: true,
      isActive: true, isSystemType: true, sortOrder: true,
      _count: { select: { requests: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 100,
  });
}

export type LeaveTypeItem = Awaited<ReturnType<typeof getLeaveTypes>>[number];
export type LeaveTypeAdminItem = Awaited<ReturnType<typeof getAllLeaveTypes>>[number];
```

- [ ] **Step 2: Create `lib/queries/leaveBalances.ts`**

```typescript
import { db } from "@/lib/db";

export async function getLeaveBalances(params: {
  profileId?: string;
  leaveTypeId?: string;
  year?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.profileId) where.profileId = params.profileId;
  if (params.leaveTypeId) where.leaveTypeId = params.leaveTypeId;
  if (params.year) where.year = params.year;

  return db.leaveBalance.findMany({
    where,
    select: {
      id: true, profileId: true, leaveTypeId: true, year: true,
      totalDays: true, usedDays: true, carryOverDays: true, adjustmentDays: true,
      profile: { select: { id: true, fullName: true, employeeNumber: true, departmentId: true } },
      leaveType: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ year: "desc" }, { leaveType: { sortOrder: "asc" } }],
    take: 1000,
  });
}

export type LeaveBalanceItem = Awaited<ReturnType<typeof getLeaveBalances>>[number];
```

- [ ] **Step 3: Create `lib/queries/leaveRequests.ts`**

```typescript
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const requestSelect = {
  id: true, profileId: true, leaveTypeId: true,
  startDate: true, endDate: true, totalDays: true,
  reason: true, status: true,
  managerApprovedBy: true, managerApprovedAt: true, managerNote: true,
  hrApprovedBy: true, hrApprovedAt: true, hrNote: true,
  rejectedBy: true, rejectedAt: true, rejectionReason: true,
  cancelledAt: true, cancellationReason: true,
  createdAt: true,
  profile: { select: { id: true, fullName: true, employeeNumber: true, avatarUrl: true, departmentId: true, department: { select: { name: true } } } },
  leaveType: { select: { id: true, name: true, code: true } },
  managerApprover: { select: { id: true, fullName: true } },
  hrApprover: { select: { id: true, fullName: true } },
  rejector: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestSelect;

export async function getLeaveRequests(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params?.status) where.status = params.status;
  if (params?.profileId) where.profileId = params.profileId;
  if (params?.departmentId) {
    where.profile = { departmentId: params.departmentId };
  }

  return db.leaveRequest.findMany({
    where,
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function getMyLeaveRequests(profileId: string) {
  return db.leaveRequest.findMany({
    where: { profileId },
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPendingForManager(managerId: string) {
  return db.leaveRequest.findMany({
    where: {
      status: "pending",
      profile: { managerId },
    },
    select: requestSelect,
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

export async function getLeaveCalendar(params: {
  departmentId?: string;
  startDate: Date;
  endDate: Date;
}) {
  const where: Prisma.LeaveRequestWhereInput = {
    status: "approved",
    startDate: { lte: params.endDate },
    endDate: { gte: params.startDate },
  };
  if (params.departmentId) {
    where.profile = { departmentId: params.departmentId };
  }

  return db.leaveRequest.findMany({
    where,
    select: {
      id: true, startDate: true, endDate: true, totalDays: true,
      profile: { select: { id: true, fullName: true, avatarUrl: true } },
      leaveType: { select: { id: true, name: true, code: true } },
    },
    orderBy: { startDate: "asc" },
    take: 500,
  });
}

export type LeaveRequestItem = Awaited<ReturnType<typeof getLeaveRequests>>[number];
export type LeaveCalendarItem = Awaited<ReturnType<typeof getLeaveCalendar>>[number];
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 4: Server Actions — Leave Type + Leave Balance

**Files:**
- Create: `actions/leaveType.ts`
- Create: `actions/leaveBalance.ts`

Follow the exact pattern from `actions/department.ts` (requirePermission → rateLimiter → Zod parse → DB → logAudit → revalidateTag).

- [ ] **Step 1: Create `actions/leaveType.ts`**

- `createLeaveType(data)` — permission `hr-leave:create`, revalidate "leave-types"
- `updateLeaveType(id, data)` — permission `hr-leave:edit`
- `deleteLeaveType(id)` — permission `hr-leave:delete`, blocked if `isSystemType` or has requests

- [ ] **Step 2: Create `actions/leaveBalance.ts`**

- `generateLeaveBalances(data)` — permission `hr-leave:create`. Validates with `generateBalancesSchema`. For each active employee + active leave type with `defaultQuota > 0`: calculate prorate using `calculateProrate()` from helpers, calculate carry-over from previous year balance, create LeaveBalance with `ON CONFLICT DO NOTHING` equivalent (try/catch P2002). Revalidate "leave-balances".
- `adjustLeaveBalance(data)` — permission `hr-leave:edit`. Validates with `adjustBalanceSchema`. Updates `adjustmentDays` on the balance. Audit logs with reason.

- [ ] **Step 3: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 5: Server Actions — Leave Request (Submit, Approve, Reject, Cancel)

**Files:**
- Create: `actions/leaveRequest.ts`

This is the most complex action file. Contains the dual approval flow and attendance integration.

- [ ] **Step 1: Create `actions/leaveRequest.ts`**

Functions:

**`submitLeaveRequest(data)`** — authenticated (any employee with `hr:view`):
1. Validate with `submitLeaveRequestSchema`
2. Get leave type, verify active
3. Calculate `totalDays` using `countWeekdays(startDate, endDate)` from helpers
4. Validate: startDate <= endDate, minDaysBeforeRequest, maxConsecutiveDays
5. If isDeductible: check available balance >= totalDays (get balance for current year)
6. Check no overlap with existing pending/manager_approved/approved requests
7. Create LeaveRequest with status `pending`
8. Audit log, revalidate "leave-requests"

**`managerApproveLeave(data)`** — authenticated, must be the employee's manager:
1. Validate with `approveLeaveSchema`
2. Get request, verify status = `pending`
3. Get requester profile, verify `managerId === session.user.profileId`
4. Update: status → `manager_approved`, set managerApprovedBy/At/Note
5. Audit log, revalidate

**`managerRejectLeave(data)`** — authenticated, must be manager:
1. Similar to above but status → `rejected`, set rejectedBy/At/Reason

**`hrApproveLeave(data)`** — permission `hr-leave:approve`:
1. Validate with `approveLeaveSchema`
2. Get request, verify status = `manager_approved`
3. Use `db.$transaction([...])` array form:
   a. Update request: status → `approved`, set hrApprovedBy/At/Note
   b. If isDeductible: update LeaveBalance.usedDays += totalDays
   c. Create Attendance records for each weekday in the leave period with status `on_leave` (skip dates that already have records — use `createMany` with `skipDuplicates` or individual creates with try/catch)
4. Audit log, revalidate "leave-requests", "leave-balances"

**Note on attendance creation:** Since Neon HTTP adapter doesn't support `createMany`, use `db.$transaction(weekdays.map(date => db.attendance.create({...})))`. To skip existing dates, wrap each create in a separate try/catch or query existing dates first and filter.

**`hrRejectLeave(data)`** — permission `hr-leave:approve`:
1. Similar to managerReject but for `manager_approved` requests

**`cancelLeaveRequest(data)`** — authenticated (own request only):
1. Validate with `cancelLeaveSchema`
2. Get request, verify ownership
3. Verify startDate > today
4. If status was `approved` and isDeductible: restore usedDays in balance + delete on_leave attendance records
5. Use transaction for the restore
6. Status → `cancelled`, set cancelledAt/Reason

- [ ] **Step 2: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 6: API Routes + Services + Hooks + Route Meta

**Files:**
- Create: 6 API route files
- Create: 3 service files
- Create: 3 hook files
- Modify: `lib/route-meta.ts`

All follow established patterns from existing attendance/department code.

- [ ] **Step 1: Create API routes**

- `app/api/hr/leave-types/route.ts` — GET, auth + apiLimiter, returns `getLeaveTypes()` or `getAllLeaveTypes()` based on permission
- `app/api/hr/leave-balances/route.ts` — GET, query params: profileId, leaveTypeId, year
- `app/api/hr/leave-requests/route.ts` — GET, `hr-leave:view` permission, query params: status, departmentId, profileId
- `app/api/hr/leave-requests/my/route.ts` — GET, auth only, returns `getMyLeaveRequests(profileId)`
- `app/api/hr/leave-requests/pending/route.ts` — GET, auth only, returns `getPendingForManager(profileId)`
- `app/api/hr/leave-calendar/route.ts` — GET, auth, query params: departmentId, startDate, endDate

- [ ] **Step 2: Create services**

- `services/leave-type-service.ts` — `fetchLeaveTypes()`
- `services/leave-request-service.ts` — `fetchLeaveRequests(params?)`, `fetchMyLeaveRequests()`, `fetchPendingForManager()`, `fetchLeaveCalendar(params)`
- `services/leave-balance-service.ts` — `fetchLeaveBalances(params)`

- [ ] **Step 3: Create hooks**

- `hooks/use-leave-types.ts` — `useLeaveTypes()` + CRUD mutations
- `hooks/use-leave-requests.ts` — `useLeaveRequests(params?)`, `useMyLeaveRequests()`, `usePendingForManager()`, `useLeaveCalendar(params)` + submit/approve/reject/cancel mutations
- `hooks/use-leave-balances.ts` — `useLeaveBalances(params)` + generate/adjust mutations

- [ ] **Step 4: Add route meta**

In `lib/route-meta.ts`, add after the database-karyawan entries:

```typescript
  "/dashboard/hr/sistem-cuti": {
    title: "Sistem Cuti",
    subtitle: "Kelola pengajuan dan saldo cuti",
    parent: "/dashboard/hr",
  },
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 7: UI — Employee View (Balance Cards + Request Form + History)

**Files:**
- Create: `app/(private)/dashboard/hr/sistem-cuti/page.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveManagement.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveBalanceCards.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveRequestForm.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveRequestHistory.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { LeaveManagement } from "./_components/LeaveManagement";

export const metadata: Metadata = {
  title: "Sistem Cuti - SWASANA",
  description: "Kelola pengajuan dan saldo cuti",
};

export default async function SistemCutiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <LeaveManagement />
    </div>
  );
}
```

- [ ] **Step 2: Create `LeaveManagement.tsx`**

Tab wrapper using `usePermissions()` to show/hide admin tabs:
- Always visible: "Cuti Saya" (balance cards + form + history)
- If user has pending subordinate requests OR hr-leave permission: "Approval" tab
- If `hr-leave:create` or `hr-leave:edit`: "Jenis Cuti" tab, "Saldo" tab
- Always: "Kalender Tim" tab

- [ ] **Step 3: Create `LeaveBalanceCards.tsx`**

Grid of cards. Each card shows: leave type name, progress bar (used/total), available days text, carry-over badge if applicable. Year selector at top. Uses `useLeaveBalances({ profileId: currentUser, year })` and `useLeaveTypes()`.

- [ ] **Step 4: Create `LeaveRequestForm.tsx`**

Card with form: leave type Select (from `useLeaveTypes()`), start/end date pickers, auto-calculated total days display, reason Textarea, submit button. Validates before submit: checks balance, shows warnings. Uses `useSubmitLeaveRequest()` mutation.

- [ ] **Step 5: Create `LeaveRequestHistory.tsx`**

Table of own requests from `useMyLeaveRequests()`. Columns: Jenis Cuti, Tanggal, Jumlah Hari, Status badge, Approval info, Actions (Cancel button for cancellable requests). Filter by status.

- [ ] **Step 6: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 8: UI — Admin/Manager View (Approval + LeaveType + Balance + Calendar)

**Files:**
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveApprovalTable.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTypeManager.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveBalanceManager.tsx`
- Create: `app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTeamCalendar.tsx`

- [ ] **Step 1: Create `LeaveApprovalTable.tsx`**

Shows pending requests. Manager sees requests from subordinates (from `usePendingForManager()`). HR user sees all `manager_approved` requests (from `useLeaveRequests({ status: "manager_approved" })`). Approve/Reject buttons open dialogs with note/reason fields. Uses manager/hr approve/reject mutations.

- [ ] **Step 2: Create `LeaveTypeManager.tsx`**

CRUD table. System types cannot be deleted (only toggled active). Custom types have full CRUD. Add/Edit dialog with all leave type fields (name, code, quota, deductible, approval, max days, min notice, carry-over settings). Permission-gated `hr-leave/create` and `hr-leave/edit`.

- [ ] **Step 3: Create `LeaveBalanceManager.tsx`**

Table: Karyawan, Jenis Cuti, Tahun, Total, Terpakai, Carry Over, Adjustment, Sisa, Actions. Filters: year, leave type, employee search. "Generate Saldo [Year]" button with confirmation dialog. Adjust button per row opens dialog with adjustment amount + reason. Permission-gated.

- [ ] **Step 4: Create `LeaveTeamCalendar.tsx`**

Monthly calendar grid. Department filter at top. Each day cell shows approved leave entries (employee name + type badge). Uses `useLeaveCalendar({ departmentId, startDate, endDate })`. Month navigation (prev/next). Simple grid implementation — 7 columns (Mon-Sun), rows for weeks.

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 9: Final Verification

- [ ] **Step 1: TypeScript check** — `npx tsc --noEmit --skipLibCheck`
- [ ] **Step 2: ESLint** — `npx eslint "app/(private)/dashboard/hr/sistem-cuti/**/*.tsx" "actions/leave*.ts" "lib/leave-helpers.ts" --max-warnings 100`
- [ ] **Step 3: Build** — `npm run build`
- [ ] **Step 4: Manual testing checklist**

1. `/dashboard/hr/sistem-cuti` — page loads, tabs render based on permission
2. Balance cards show (empty initially, or after generating)
3. Leave type manager — create custom type, edit, deactivate system type
4. Generate balances for current year — balances appear for active employees
5. Submit leave request — validates dates, balance, creates pending request
6. Manager approval tab — shows pending requests, approve one
7. HR approval tab — shows manager_approved, approve → status becomes approved
8. After HR approve: check Attendance table for on_leave records
9. Cancel an approved request — balance restored, attendance records removed
10. Team calendar — shows approved leaves
11. Adjust balance — add/subtract days with reason
