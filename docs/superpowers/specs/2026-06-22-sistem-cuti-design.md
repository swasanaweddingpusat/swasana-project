# Sistem Cuti (Leave Management) — Design Spec

**Date:** 2026-06-22
**Module:** HR & Payroll — Leave Management
**Status:** Approved
**Prerequisite:** Attendance Enhancement (multi-location & shift) — should be complete first for `on_leave` status integration

---

## 1. Overview

Full-featured leave management system with preset leave types (UU Ketenagakerjaan), custom leave types, per-employee annual balance with prorate, dual approval flow (Manager → HR), and integration with the attendance system (auto-create attendance records on approved leave).

### Key Features

- Preset + custom leave types with configurable rules (quota, deductibility, carry-over, min notice, max consecutive days)
- Annual leave balance per employee per leave type with prorate for mid-year joiners
- Dual approval: Manager (direct supervisor) → HR (final)
- Auto-create `Attendance` records with `on_leave` status when leave is approved
- Team calendar view for managers to see department leave schedule
- Leave request cancellation with balance restoration

---

## 2. Data Model

### 2.1 LeaveType (New)

```prisma
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

- `code`: unique slug for programmatic reference (e.g., "annual", "sick", "marriage")
- `defaultQuota`: days per year. 0 = unlimited (e.g., cuti sakit panjang, cuti tanpa gaji)
- `isDeductible`: whether taking this leave reduces the balance
- `maxConsecutiveDays`: max days in a single request (null = unlimited)
- `minDaysBeforeRequest`: minimum days before `startDate` that the request must be submitted (0 = same-day allowed)
- `isCarryOver`: whether unused balance carries to next year
- `carryOverMaxDays`: max carry-over days (null = all remaining carries)
- `carryOverExpiryMonths`: months from Jan 1 until carry-over expires (null = never expires within the year)
- `isSystemType`: true for UU presets, cannot be deleted (only deactivated)

### 2.2 LeaveBalance (New)

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

- `totalDays`: prorated quota for the year
- `usedDays`: days consumed by approved leave requests
- `carryOverDays`: days carried from previous year (included in available calculation)
- `adjustmentDays`: manual adjustments by HR (can be positive or negative)
- **Available balance** = `totalDays + carryOverDays + adjustmentDays - usedDays`

### 2.3 LeaveRequestStatus (New Enum)

```prisma
enum LeaveRequestStatus {
  pending
  manager_approved
  approved
  rejected
  cancelled
}
```

### 2.4 LeaveRequest (New)

```prisma
model LeaveRequest {
  id                String              @id @default(uuid())
  profileId         String
  leaveTypeId       String
  startDate         DateTime
  endDate           DateTime
  totalDays         Int
  reason            String?
  status            LeaveRequestStatus  @default(pending)

  managerApprovedBy String?
  managerApprovedAt DateTime?
  managerNote       String?

  hrApprovedBy      String?
  hrApprovedAt      DateTime?
  hrNote            String?

  rejectedBy        String?
  rejectedAt        DateTime?
  rejectionReason   String?

  cancelledAt       DateTime?
  cancellationReason String?

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  profile           Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)
  leaveType         LeaveType           @relation(fields: [leaveTypeId], references: [id], onDelete: Cascade)
  managerApprover   Profile?            @relation("LeaveManagerApprover", fields: [managerApprovedBy], references: [id], onDelete: SetNull)
  hrApprover        Profile?            @relation("LeaveHrApprover", fields: [hrApprovedBy], references: [id], onDelete: SetNull)
  rejector          Profile?            @relation("LeaveRejector", fields: [rejectedBy], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([leaveTypeId])
  @@index([status])
  @@index([startDate])
  @@index([endDate])
  @@map("leave_requests")
}
```

### 2.5 AttendanceStatus Enum Change

Add `on_leave` to the existing enum:

```prisma
enum AttendanceStatus {
  on_time
  late
  absent
  on_leave   // NEW — auto-created when leave is approved
}
```

### 2.6 Profile Model Changes

Add reverse relations:

```prisma
// Add to Profile model
leaveBalances             LeaveBalance[]
leaveRequests             LeaveRequest[]
leaveManagerApprovals     LeaveRequest[]  @relation("LeaveManagerApprover")
leaveHrApprovals          LeaveRequest[]  @relation("LeaveHrApprover")
leaveRejections           LeaveRequest[]  @relation("LeaveRejector")
```

---

## 3. Business Logic

### 3.1 Leave Request Submission

1. Employee selects leave type, start date, end date, enters reason
2. System calculates `totalDays`:
   - Count calendar days from `startDate` to `endDate` inclusive
   - Exclude Saturdays and Sundays (weekday-only count)
   - Future enhancement: exclude public holidays from a holiday calendar
3. Validations:
   - Leave type is active
   - `startDate <= endDate`
   - `startDate >= today + minDaysBeforeRequest` (for the leave type)
   - `totalDays <= maxConsecutiveDays` (if set on leave type)
   - If `isDeductible`: available balance >= `totalDays`
   - No overlap with existing approved/pending leave requests for same employee
4. Status set to `pending`
5. Notification sent to manager (Profile.managerId)

### 3.2 Dual Approval Flow

```
pending ──[Manager approves]──> manager_approved ──[HR approves]──> approved
  │                                    │
  └──[Manager rejects]──> rejected     └──[HR rejects]──> rejected
  │
  └──[Employee cancels]──> cancelled
```

**Manager Approval (Step 1):**
- Manager of the requesting employee (Profile.managerId) reviews
- Manager can approve (with optional note) or reject (with reason)
- On approve: status → `manager_approved`, record `managerApprovedBy`, `managerApprovedAt`, `managerNote`
- On reject: status → `rejected`, record `rejectedBy`, `rejectedAt`, `rejectionReason`

**HR Approval (Step 2):**
- User with `hr-leave:approve` permission reviews `manager_approved` requests
- HR can approve (with optional note) or reject (with reason)
- On approve:
  1. Status → `approved`
  2. Record `hrApprovedBy`, `hrApprovedAt`, `hrNote`
  3. Deduct `usedDays` from `LeaveBalance` (if `isDeductible`)
  4. Auto-create `Attendance` records for each leave day with `status = on_leave`
  5. Audit log
- On reject: status → `rejected`, record `rejectedBy`, `rejectedAt`, `rejectionReason`

### 3.3 Leave Cancellation

- Employee can cancel leave request if `startDate > today` (leave hasn't started)
- If status was `approved`:
  1. Restore `usedDays` in `LeaveBalance`
  2. Delete auto-created `Attendance` records with `status = on_leave` for the leave period
- Status → `cancelled`, record `cancelledAt`, `cancellationReason`

### 3.4 Auto-Create Attendance Records

When a leave request is approved:

```
for each weekday between startDate and endDate:
  create Attendance {
    profileId: requester's profileId,
    date: the weekday (midnight UTC),
    status: on_leave,
    clockInAt: null,
    clockOutAt: null,
    // GPS/photo fields all null
  }
```

Use `db.$transaction([...])` to atomically create all records.

Skip dates that already have an Attendance record (employee clocked in before leave was approved for some reason — don't overwrite).

### 3.5 Annual Balance Generation

Admin triggers "Generate Saldo Tahun [year]":

1. For each active employee (`Profile.status = active`):
2. For each active leave type where `defaultQuota > 0`:
3. Calculate prorate:
   - If employee `joinDate` is in the target year: `Math.ceil((remainingMonths / 12) * defaultQuota)` where `remainingMonths = 12 - joinMonth + 1`
   - If employee joined before target year: full `defaultQuota`
4. Calculate carry-over from previous year:
   - If leave type `isCarryOver`: `Math.min(previousYearRemaining, carryOverMaxDays ?? previousYearRemaining)`
   - Otherwise: 0
5. Create `LeaveBalance { profileId, leaveTypeId, year, totalDays, carryOverDays, usedDays: 0, adjustmentDays: 0 }`
6. Use `ON CONFLICT (profileId, leaveTypeId, year) DO NOTHING` — don't overwrite existing balances

### 3.6 Manual Balance Adjustment

HR can manually adjust an employee's balance via the `adjustmentDays` field:
- Positive: extra days granted (reward, compensation)
- Negative: days deducted (disciplinary, correction)
- Audit logged with reason

---

## 4. API Layer

### 4.1 API Routes

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/hr/leave-types` | `hr-leave:view` | List leave types |
| GET | `/api/hr/leave-balances` | `hr-leave:view` | List balances (filtered by profileId, year) |
| GET | `/api/hr/leave-requests` | `hr-leave:view` | List requests (filtered) |
| GET | `/api/hr/leave-requests/my` | authenticated | My leave requests |
| GET | `/api/hr/leave-requests/pending` | authenticated | Pending requests for manager approval |
| GET | `/api/hr/leave-calendar` | `hr-leave:view` | Calendar data for department/date range |

### 4.2 Server Actions

| Action | Permission | Description |
|---|---|---|
| `createLeaveType` | `hr-leave:create` | Create leave type |
| `updateLeaveType` | `hr-leave:edit` | Update leave type |
| `deleteLeaveType` | `hr-leave:delete` | Delete (blocked if system type or has requests) |
| `generateLeaveBalances` | `hr-leave:create` | Generate annual balances for all employees |
| `adjustLeaveBalance` | `hr-leave:edit` | Manual balance adjustment |
| `submitLeaveRequest` | authenticated | Submit leave request |
| `cancelLeaveRequest` | authenticated | Cancel own request (before start date) |
| `managerApproveLeave` | authenticated (must be managerId) | Manager approve |
| `managerRejectLeave` | authenticated (must be managerId) | Manager reject |
| `hrApproveLeave` | `hr-leave:approve` | HR final approve |
| `hrRejectLeave` | `hr-leave:approve` | HR reject |

---

## 5. UI Pages

### 5.1 Employee View — `/dashboard/hr/sistem-cuti`

**Permission:** `hr:view` (employee-level access)

**Saldo Card Section:**
- Grid of cards per leave type showing: type name, used/total progress bar, available days
- Year selector to view different periods
- Carry-over days shown separately if applicable

**Pengajuan Cuti Form (Card):**
- Leave type (Select)
- Start date, End date (date pickers)
- Total days (auto-calculated, excludes weekends)
- Reason (Textarea)
- Submit button

**Riwayat Pengajuan (Card + Table):**
- Table: Jenis Cuti, Tanggal, Jumlah Hari, Status badge, Approval Info, Actions
- Status badges: pending=secondary, manager_approved=outline, approved=default, rejected=destructive, cancelled=secondary
- Filter by status, date range
- Cancel action (for pending/manager_approved requests before start date)

**Kalender Tim (Card):**
- Monthly calendar view
- Shows leave entries for employees in same department
- Each entry: employee name + leave type badge
- Helps employee check if colleagues are on leave before requesting

### 5.2 Admin/Manager View — Same route, enhanced by permissions

**Tab: Pengajuan (visible to managers + HR)**
- Table of leave requests pending action
- Manager sees only requests from their subordinates
- HR sees all `manager_approved` requests
- Approve/Reject buttons with note/reason dialog
- Filter by department, status, date range

**Tab: Jenis Cuti (visible to `hr-leave:create/edit`)**
- Table: Name, Code, Quota, Deductible, Carry-Over, Status, Actions
- System types: can deactivate but not delete
- Custom types: full CRUD
- Add/Edit dialog with all leave type fields

**Tab: Saldo (visible to `hr-leave:edit`)**
- Table: Karyawan, Jenis Cuti, Tahun, Total, Terpakai, Sisa, Adjustment, Actions
- Filter by employee, leave type, year
- "Generate Saldo [Year]" button → confirmation dialog
- Adjust balance button per row → dialog with adjustment amount + reason

**Tab: Kalender**
- Full calendar view of all approved leaves across the company
- Filter by department
- Each day shows who is on leave with leave type

---

## 6. Validation Schemas

### 6.1 `lib/validations/leaveType.ts`

```typescript
createLeaveTypeSchema = {
  name: string.min(1),
  code: string.min(1).regex(/^[a-z][a-z0-9_]*$/),
  description: string?.optional(),
  defaultQuota: int.min(0).default(0),
  isDeductible: boolean.default(true),
  requiresApproval: boolean.default(true),
  maxConsecutiveDays: int.min(1)?.optional(),
  minDaysBeforeRequest: int.min(0).default(0),
  isCarryOver: boolean.default(false),
  carryOverMaxDays: int.min(1)?.optional(),
  carryOverExpiryMonths: int.min(1).max(12)?.optional(),
}
```

### 6.2 `lib/validations/leaveRequest.ts`

```typescript
submitLeaveRequestSchema = {
  leaveTypeId: string,
  startDate: date,
  endDate: date,
  reason: string?.optional(),
}

approveLeaveSchema = {
  requestId: string,
  note: string?.optional(),
}

rejectLeaveSchema = {
  requestId: string,
  reason: string.min(1),
}

cancelLeaveSchema = {
  requestId: string,
  reason: string?.optional(),
}
```

### 6.3 `lib/validations/leaveBalance.ts`

```typescript
generateBalancesSchema = {
  year: int.min(2020).max(2100),
}

adjustBalanceSchema = {
  balanceId: string,
  adjustmentDays: int (can be negative),
  reason: string.min(1),
}
```

---

## 7. Permissions (Seed via Migration)

```sql
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-leave', 'view', 'View leave types, balances, requests', 23),
  (gen_random_uuid()::text, 'hr-leave', 'create', 'Create leave types, generate balances', 23),
  (gen_random_uuid()::text, 'hr-leave', 'edit', 'Edit leave types, adjust balances', 23),
  (gen_random_uuid()::text, 'hr-leave', 'delete', 'Delete custom leave types', 23),
  (gen_random_uuid()::text, 'hr-leave', 'approve', 'Approve/reject leave requests (HR level)', 23)
ON CONFLICT (module, action) DO NOTHING;
```

---

## 8. File Structure

```
prisma/migrations/YYYYMMDD_add_leave_management/migration.sql

lib/validations/leaveType.ts
lib/validations/leaveRequest.ts
lib/validations/leaveBalance.ts

lib/queries/leaveTypes.ts
lib/queries/leaveBalances.ts
lib/queries/leaveRequests.ts

actions/leaveType.ts
actions/leaveRequest.ts
actions/leaveBalance.ts

services/leave-type-service.ts
services/leave-request-service.ts
services/leave-balance-service.ts

hooks/use-leave-types.ts
hooks/use-leave-requests.ts
hooks/use-leave-balances.ts

app/api/hr/leave-types/route.ts
app/api/hr/leave-balances/route.ts
app/api/hr/leave-requests/route.ts
app/api/hr/leave-requests/my/route.ts
app/api/hr/leave-requests/pending/route.ts
app/api/hr/leave-calendar/route.ts

app/(private)/dashboard/hr/sistem-cuti/page.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveBalanceCards.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveRequestForm.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveRequestHistory.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTeamCalendar.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveApprovalTable.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTypeManager.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveTypeDialog.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveBalanceManager.tsx
app/(private)/dashboard/hr/sistem-cuti/_components/LeaveApprovalDialog.tsx
```

Modified files:
```
prisma/schema.prisma — add LeaveType, LeaveBalance, LeaveRequest models + enum
lib/route-meta.ts — add /dashboard/hr/sistem-cuti entry
```

---

## 9. Migration Strategy

Single migration file:

1. Add `on_leave` to `AttendanceStatus` enum
2. Create `leave_types` table
3. Create `leave_balances` table
4. Create `leave_requests` table with all approval tracking columns
5. Add FK constraints and indexes
6. Seed preset leave types (8 types from UU Ketenagakerjaan)
7. Seed permissions (5 entries)

All DDL uses `IF NOT EXISTS` for idempotency.

---

## 10. Key Design Decisions

1. **Preset + Custom leave types** — System ships with UU-compliant presets (`isSystemType = true`) that cannot be deleted. Admin can add custom types (birthday leave, WFH, etc.) with their own rules.

2. **Dual approval without ApprovalFlow module** — Uses a fixed 2-step flow (Manager → HR) instead of the configurable ApprovalFlow system. This is simpler and more predictable for leave management. The Manager is determined by `Profile.managerId`, HR approval requires `hr-leave:approve` permission.

3. **Weekday-only calculation** — `totalDays` counts weekdays between start and end date. Public holidays are excluded in a future enhancement (requires a holiday calendar model). This keeps the initial implementation simple.

4. **Attendance integration** — Approved leave auto-creates Attendance records with `on_leave` status. This keeps the attendance table as the single source of truth for daily employee status. The attendance recap table will show leave days alongside regular attendance.

5. **Balance generation vs auto-accrual** — Balance is generated annually (with prorate for new joiners) rather than monthly accrual. This matches Indonesian labor law where annual leave is granted upfront after 12 months of employment.

6. **Carry-over with expiry** — Unused leave can carry over to the next year with configurable limits (max days, expiry months). This matches common HR policies while keeping the model simple.

7. **Single page for employee + admin** — `/dashboard/hr/sistem-cuti` serves both roles. Employees see their balance and request form. Admins/managers see additional tabs for approval and management. This avoids creating separate routes.

8. **No document attachment** — Leave requests do not support file attachments in this version. If needed later, can be added as a simple `attachmentUrl` field on `LeaveRequest` without schema changes beyond the new column.
