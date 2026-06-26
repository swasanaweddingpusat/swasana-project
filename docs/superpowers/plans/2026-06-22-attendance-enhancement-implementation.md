# Attendance Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the attendance system to support multiple work locations (per-venue + custom), multiple work shifts with per-shift tolerance, employee-to-location/shift assignments, and daily shift overrides.

**Architecture:** Add 4 new Prisma models (WorkLocation, WorkShift, EmployeeWorkAssignment, ShiftOverride). Update the clock-in/clock-out flow to resolve shifts and validate GPS against assigned locations. Replace the single AttendanceSettingsPanel with a tabbed settings section. Keep AttendanceSettings as global defaults.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Neon HTTP adapter), Zod v4, TanStack Query v5, shadcn v4 + Tailwind v4, Solar Icons BoldDuotone.

**Spec:** `docs/superpowers/specs/2026-06-22-attendance-enhancement-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `prisma/migrations/20260622120000_add_attendance_locations_shifts/migration.sql` | Schema migration + data migration + permission seeds |
| `lib/validations/workLocation.ts` | Zod schemas for work location CRUD |
| `lib/validations/workShift.ts` | Zod schemas for work shift CRUD |
| `lib/validations/workAssignment.ts` | Zod schemas for assignment CRUD + bulk |
| `lib/validations/shiftOverride.ts` | Zod schemas for shift override CRUD |
| `lib/queries/workLocations.ts` | Server-side queries: getWorkLocations |
| `lib/queries/workShifts.ts` | Server-side queries: getWorkShifts |
| `lib/queries/workAssignments.ts` | Server-side queries: getWorkAssignments, getEmployeeActiveAssignments |
| `lib/queries/shiftOverrides.ts` | Server-side queries: getShiftOverrides |
| `lib/attendance-helpers.ts` | Shared helpers: haversineDistance, resolveEmployeeShift, validateGpsAgainstLocations, determineStatus |
| `actions/workLocation.ts` | Server actions: CRUD work locations |
| `actions/workShift.ts` | Server actions: CRUD work shifts |
| `actions/workAssignment.ts` | Server actions: CRUD + bulk assignments |
| `actions/shiftOverride.ts` | Server actions: CRUD shift overrides |
| `app/api/hr/work-locations/route.ts` | GET work locations |
| `app/api/hr/work-shifts/route.ts` | GET work shifts |
| `app/api/hr/work-assignments/route.ts` | GET work assignments |
| `app/api/hr/shift-overrides/route.ts` | GET shift overrides |
| `services/work-location-service.ts` | Client fetch wrapper |
| `services/work-shift-service.ts` | Client fetch wrapper |
| `services/work-assignment-service.ts` | Client fetch wrapper |
| `services/shift-override-service.ts` | Client fetch wrapper |
| `hooks/use-work-locations.ts` | TanStack Query hooks |
| `hooks/use-work-shifts.ts` | TanStack Query hooks |
| `hooks/use-work-assignments.ts` | TanStack Query hooks |
| `hooks/use-shift-overrides.ts` | TanStack Query hooks |
| `app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkLocationManager.tsx` | Location CRUD table + dialog |
| `app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkShiftManager.tsx` | Shift CRUD table + dialog |
| `app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkAssignmentManager.tsx` | Assignment CRUD table + dialog |
| `app/(private)/dashboard/hr/manajemen-kehadiran/_components/ShiftOverrideManager.tsx` | Override CRUD table + dialog |
| `app/(private)/dashboard/hr/manajemen-kehadiran/_components/GlobalSettingsPanel.tsx` | Global defaults form |

### Modified Files

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add 4 new models, update Attendance/Profile/Venue/AttendanceSettings |
| `lib/validations/attendance.ts` | Add `globalAttendanceSettingsSchema` |
| `lib/queries/attendance.ts` | Update queries to include workLocation/workShift in responses |
| `app/api/hr/attendance/clock-in/route.ts` | New shift resolution + multi-location GPS validation |
| `app/api/hr/attendance/clock-out/route.ts` | Optional GPS validation based on settings |
| `app/api/hr/attendance/settings/route.ts` | Accept new global settings shape alongside legacy |
| `app/api/hr/attendance/today/route.ts` | Include resolved shift + location info in response |
| `app/(private)/dashboard/hr/manajemen-kehadiran/page.tsx` | Restructure with tabbed settings |
| `app/(private)/dashboard/hr/manajemen-kehadiran/_components/AttendanceTable.tsx` | Add location/shift columns |
| `app/(private)/dashboard/hr/absensi/_components/AttendanceClock.tsx` | Show shift/location info |
| `hooks/use-attendance.ts` | Add global settings hooks |
| `services/attendance-service.ts` | Add global settings service |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260622120000_add_attendance_locations_shifts/migration.sql`

- [ ] **Step 1: Add WorkLocation model to schema**

After the `AttendanceSettings` model (line ~1608), add:

```prisma
// ─── Attendance Enhancement: Multi-Location & Shifts ─────────────────────────

model WorkLocation {
  id             String    @id @default(uuid())
  name           String
  address        String?
  venueId        String?
  latitude       Float
  longitude      Float
  radiusMeters   Int       @default(100)
  isActive       Boolean   @default(true)
  sortOrder      Int       @default(0)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  venue          Venue?    @relation(fields: [venueId], references: [id], onDelete: SetNull)
  assignments    EmployeeWorkAssignment[]
  overrides      ShiftOverride[]
  attendances    Attendance[]

  @@index([venueId])
  @@map("work_locations")
}
```

- [ ] **Step 2: Add WorkShift model to schema**

```prisma
model WorkShift {
  id                     String    @id @default(uuid())
  name                   String
  startTime              String
  endTime                String
  lateToleranceMinutes   Int       @default(15)
  isOvernight            Boolean   @default(false)
  isActive               Boolean   @default(true)
  sortOrder              Int       @default(0)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  assignments            EmployeeWorkAssignment[]
  overrides              ShiftOverride[]
  attendances            Attendance[]

  @@map("work_shifts")
}
```

- [ ] **Step 3: Add EmployeeWorkAssignment model to schema**

```prisma
model EmployeeWorkAssignment {
  id              String       @id @default(uuid())
  profileId       String
  workLocationId  String
  workShiftId     String
  isDefault       Boolean      @default(false)
  effectiveDate   DateTime
  endDate         DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  profile         Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)
  workLocation    WorkLocation @relation(fields: [workLocationId], references: [id], onDelete: Cascade)
  workShift       WorkShift    @relation(fields: [workShiftId], references: [id], onDelete: Cascade)

  @@unique([profileId, workLocationId, workShiftId])
  @@index([profileId])
  @@index([workLocationId])
  @@index([workShiftId])
  @@map("employee_work_assignments")
}
```

- [ ] **Step 4: Add ShiftOverride model to schema**

```prisma
model ShiftOverride {
  id              String        @id @default(uuid())
  profileId       String
  date            DateTime
  workShiftId     String
  workLocationId  String?
  reason          String?
  createdBy       String?
  createdAt       DateTime      @default(now())

  profile         Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  workShift       WorkShift     @relation(fields: [workShiftId], references: [id], onDelete: Cascade)
  workLocation    WorkLocation? @relation(fields: [workLocationId], references: [id], onDelete: SetNull)
  creator         Profile?      @relation("ShiftOverrideCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@unique([profileId, date])
  @@index([profileId])
  @@index([date])
  @@map("shift_overrides")
}
```

- [ ] **Step 5: Update Attendance model**

Add these fields to the existing `Attendance` model, after the `status` field (line ~1593):

```prisma
  workLocationId  String?
  workShiftId     String?
```

Add these relations after the existing `profile` relation:

```prisma
  workLocation    WorkLocation? @relation(fields: [workLocationId], references: [id], onDelete: SetNull)
  workShift       WorkShift?    @relation(fields: [workShiftId], references: [id], onDelete: SetNull)
```

Add indexes:

```prisma
  @@index([workLocationId])
  @@index([workShiftId])
```

- [ ] **Step 6: Update AttendanceSettings model**

Add these fields after `officeRadiusMeters`:

```prisma
  defaultLateToleranceMinutes Int      @default(15)
  requireClockOutLocation     Boolean  @default(false)
```

- [ ] **Step 7: Update Profile model**

Add these reverse relations after the existing `attendances` relation:

```prisma
  workAssignments        EmployeeWorkAssignment[]
  shiftOverrides         ShiftOverride[]
  shiftOverridesCreated  ShiftOverride[]  @relation("ShiftOverrideCreator")
```

- [ ] **Step 8: Update Venue model**

Add this reverse relation to the Venue model (after existing relations like `maintenanceTickets`):

```prisma
  workLocations  WorkLocation[]
```

- [ ] **Step 9: Create migration SQL file**

Create `prisma/migrations/20260622120000_add_attendance_locations_shifts/migration.sql`:

```sql
-- CreateTable: work_locations
CREATE TABLE IF NOT EXISTS "work_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "venueId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_locations_venueId_idx" ON "work_locations"("venueId");

-- CreateTable: work_shifts
CREATE TABLE IF NOT EXISTS "work_shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_work_assignments
CREATE TABLE IF NOT EXISTS "employee_work_assignments" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "workLocationId" TEXT NOT NULL,
    "workShiftId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_work_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_work_assignments_profileId_workLocationId_workShiftId_key" ON "employee_work_assignments"("profileId", "workLocationId", "workShiftId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_profileId_idx" ON "employee_work_assignments"("profileId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_workLocationId_idx" ON "employee_work_assignments"("workLocationId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_workShiftId_idx" ON "employee_work_assignments"("workShiftId");

-- CreateTable: shift_overrides
CREATE TABLE IF NOT EXISTS "shift_overrides" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workShiftId" TEXT NOT NULL,
    "workLocationId" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shift_overrides_profileId_date_key" ON "shift_overrides"("profileId", "date");
CREATE INDEX IF NOT EXISTS "shift_overrides_profileId_idx" ON "shift_overrides"("profileId");
CREATE INDEX IF NOT EXISTS "shift_overrides_date_idx" ON "shift_overrides"("date");

-- AlterTable: attendances — add location/shift columns
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workLocationId" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workShiftId" TEXT;
CREATE INDEX IF NOT EXISTS "attendances_workLocationId_idx" ON "attendances"("workLocationId");
CREATE INDEX IF NOT EXISTS "attendances_workShiftId_idx" ON "attendances"("workShiftId");

-- AlterTable: attendance_settings — add new global defaults
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "defaultLateToleranceMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "requireClockOutLocation" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKeys
DO $$ BEGIN
  ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate existing data: create default WorkLocation + WorkShift from AttendanceSettings
DO $$
DECLARE
  v_settings_id TEXT;
  v_start_time TEXT;
  v_end_time TEXT;
  v_tolerance INT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_radius INT;
  v_loc_id TEXT;
  v_shift_id TEXT;
BEGIN
  SELECT id, "workStartTime", "workEndTime", "lateToleranceMinutes", "officeLatitude", "officeLongitude", "officeRadiusMeters"
  INTO v_settings_id, v_start_time, v_end_time, v_tolerance, v_lat, v_lng, v_radius
  FROM attendance_settings
  LIMIT 1;

  IF v_settings_id IS NOT NULL THEN
    v_loc_id := gen_random_uuid()::text;
    v_shift_id := gen_random_uuid()::text;

    INSERT INTO work_locations (id, name, latitude, longitude, "radiusMeters", "isActive", "sortOrder", "createdAt", "updatedAt")
    VALUES (v_loc_id, 'Kantor Utama', v_lat, v_lng, v_radius, true, 0, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    INSERT INTO work_shifts (id, name, "startTime", "endTime", "lateToleranceMinutes", "isOvernight", "isActive", "sortOrder", "createdAt", "updatedAt")
    VALUES (v_shift_id, 'Reguler', v_start_time, v_end_time, v_tolerance, false, true, 0, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    UPDATE attendance_settings SET "defaultLateToleranceMinutes" = v_tolerance WHERE id = v_settings_id;
  END IF;
END $$;

-- Seed permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-attendance', 'view', 'View attendance settings, locations, shifts', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'create', 'Create locations, shifts, assignments', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'edit', 'Edit locations, shifts, assignments, overrides', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'delete', 'Delete locations, shifts', 20)
ON CONFLICT (module, action) DO NOTHING;
```

- [ ] **Step 10: Validate Prisma schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 11: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

---

### Task 2: Validation Schemas

**Files:**
- Create: `lib/validations/workLocation.ts`
- Create: `lib/validations/workShift.ts`
- Create: `lib/validations/workAssignment.ts`
- Create: `lib/validations/shiftOverride.ts`
- Modify: `lib/validations/attendance.ts`

- [ ] **Step 1: Create `lib/validations/workLocation.ts`**

```typescript
import { z } from "zod";

export const createWorkLocationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
  address: z.string().optional(),
  venueId: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000).default(100),
});

export const updateWorkLocationSchema = createWorkLocationSchema.partial();

export type CreateWorkLocationInput = z.infer<typeof createWorkLocationSchema>;
export type UpdateWorkLocationInput = z.infer<typeof updateWorkLocationSchema>;
```

- [ ] **Step 2: Create `lib/validations/workShift.ts`**

```typescript
import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

export const createWorkShiftSchema = z.object({
  name: z.string().min(1, "Nama shift wajib diisi"),
  startTime: z.string().regex(timeRegex, "Format jam harus HH:MM"),
  endTime: z.string().regex(timeRegex, "Format jam harus HH:MM"),
  lateToleranceMinutes: z.number().int().min(0).max(120).default(15),
  isOvernight: z.boolean().default(false),
});

export const updateWorkShiftSchema = createWorkShiftSchema.partial();

export type CreateWorkShiftInput = z.infer<typeof createWorkShiftSchema>;
export type UpdateWorkShiftInput = z.infer<typeof updateWorkShiftSchema>;
```

- [ ] **Step 3: Create `lib/validations/workAssignment.ts`**

```typescript
import { z } from "zod";

export const createWorkAssignmentSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  workLocationId: z.string().min(1, "Lokasi wajib dipilih"),
  workShiftId: z.string().min(1, "Shift wajib dipilih"),
  isDefault: z.boolean().default(false),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const updateWorkAssignmentSchema = createWorkAssignmentSchema.omit({ profileId: true }).partial();

export const bulkCreateWorkAssignmentSchema = z.object({
  profileIds: z.array(z.string()).min(1, "Pilih minimal satu karyawan"),
  workLocationId: z.string().min(1, "Lokasi wajib dipilih"),
  workShiftId: z.string().min(1, "Shift wajib dipilih"),
  isDefault: z.boolean().default(false),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export type CreateWorkAssignmentInput = z.infer<typeof createWorkAssignmentSchema>;
export type UpdateWorkAssignmentInput = z.infer<typeof updateWorkAssignmentSchema>;
export type BulkCreateWorkAssignmentInput = z.infer<typeof bulkCreateWorkAssignmentSchema>;
```

- [ ] **Step 4: Create `lib/validations/shiftOverride.ts`**

```typescript
import { z } from "zod";

export const createShiftOverrideSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  date: z.coerce.date(),
  workShiftId: z.string().min(1, "Shift wajib dipilih"),
  workLocationId: z.string().optional(),
  reason: z.string().optional(),
});

export const updateShiftOverrideSchema = createShiftOverrideSchema.omit({ profileId: true }).partial();

export type CreateShiftOverrideInput = z.infer<typeof createShiftOverrideSchema>;
export type UpdateShiftOverrideInput = z.infer<typeof updateShiftOverrideSchema>;
```

- [ ] **Step 5: Add `globalAttendanceSettingsSchema` to `lib/validations/attendance.ts`**

Add at the end of the file, before the type exports:

```typescript
export const globalAttendanceSettingsSchema = z.object({
  defaultLateToleranceMinutes: z.number().int().min(0).max(120).default(15),
  requireClockOutLocation: z.boolean().default(false),
});

export type GlobalAttendanceSettingsInput = z.infer<typeof globalAttendanceSettingsSchema>;
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

---

### Task 3: Shared Attendance Helpers + Database Queries

**Files:**
- Create: `lib/attendance-helpers.ts`
- Create: `lib/queries/workLocations.ts`
- Create: `lib/queries/workShifts.ts`
- Create: `lib/queries/workAssignments.ts`
- Create: `lib/queries/shiftOverrides.ts`
- Modify: `lib/queries/attendance.ts`

- [ ] **Step 1: Create `lib/attendance-helpers.ts`**

Extract and enhance the haversine + status logic from the clock-in route into a shared module:

```typescript
import { db } from "@/lib/db";
import { todayMidnightUTC } from "@/lib/queries/attendance";

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function determineStatus(
  clockInAt: Date,
  startTime: string,
  lateToleranceMinutes: number,
  isOvernight: boolean,
): "on_time" | "late" {
  const [h, m] = startTime.split(":").map(Number);
  const deadline = new Date(clockInAt);
  if (isOvernight) {
    deadline.setHours(h, m + lateToleranceMinutes, 0, 0);
    if (deadline < clockInAt && (clockInAt.getHours() < 12)) {
      deadline.setDate(deadline.getDate() - 1);
    }
  } else {
    deadline.setHours(h, m + lateToleranceMinutes, 0, 0);
  }
  return clockInAt <= deadline ? "on_time" : "late";
}

interface ResolvedShift {
  workShiftId: string;
  workShift: { id: string; name: string; startTime: string; endTime: string; lateToleranceMinutes: number; isOvernight: boolean };
  workLocationId: string | null;
  source: "override" | "assignment";
}

export async function resolveEmployeeShift(profileId: string, date: Date): Promise<ResolvedShift | null> {
  const override = await db.shiftOverride.findUnique({
    where: { profileId_date: { profileId, date } },
    include: { workShift: true },
  });

  if (override) {
    return {
      workShiftId: override.workShiftId,
      workShift: override.workShift,
      workLocationId: override.workLocationId,
      source: "override",
    };
  }

  const assignment = await db.employeeWorkAssignment.findFirst({
    where: {
      profileId,
      isDefault: true,
      effectiveDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gte: date } },
      ],
    },
    include: { workShift: true, workLocation: true },
  });

  if (assignment) {
    return {
      workShiftId: assignment.workShiftId,
      workShift: assignment.workShift,
      workLocationId: assignment.workLocationId,
      source: "assignment",
    };
  }

  return null;
}

interface LocationValidationResult {
  valid: boolean;
  nearestLocationId: string | null;
  nearestLocationName: string | null;
  distance: number;
}

export async function validateGpsAgainstLocations(
  profileId: string,
  lat: number,
  lng: number,
  date: Date,
  overrideLocationId: string | null,
): Promise<LocationValidationResult> {
  let locations: Array<{ id: string; name: string; latitude: number; longitude: number; radiusMeters: number }>;

  if (overrideLocationId) {
    const loc = await db.workLocation.findUnique({
      where: { id: overrideLocationId },
      select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    });
    locations = loc ? [loc] : [];
  } else {
    const assignments = await db.employeeWorkAssignment.findMany({
      where: {
        profileId,
        effectiveDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      include: {
        workLocation: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true, isActive: true } },
      },
    });
    locations = assignments
      .map((a) => a.workLocation)
      .filter((l) => l.isActive);
  }

  if (locations.length === 0) {
    return { valid: false, nearestLocationId: null, nearestLocationName: null, distance: Infinity };
  }

  let nearest = locations[0];
  let minDist = haversineDistance(lat, lng, nearest.latitude, nearest.longitude);

  for (let i = 1; i < locations.length; i++) {
    const d = haversineDistance(lat, lng, locations[i].latitude, locations[i].longitude);
    if (d < minDist) {
      minDist = d;
      nearest = locations[i];
    }
  }

  return {
    valid: minDist <= nearest.radiusMeters,
    nearestLocationId: nearest.id,
    nearestLocationName: nearest.name,
    distance: minDist,
  };
}
```

- [ ] **Step 2: Create `lib/queries/workLocations.ts`**

```typescript
import { db } from "@/lib/db";

export async function getWorkLocations() {
  return db.workLocation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      address: true,
      venueId: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
      isActive: true,
      sortOrder: true,
      venue: { select: { id: true, name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 200,
  });
}

export type WorkLocationItem = Awaited<ReturnType<typeof getWorkLocations>>[number];
```

- [ ] **Step 3: Create `lib/queries/workShifts.ts`**

```typescript
import { db } from "@/lib/db";

export async function getWorkShifts() {
  return db.workShift.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      lateToleranceMinutes: true,
      isOvernight: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 200,
  });
}

export type WorkShiftItem = Awaited<ReturnType<typeof getWorkShifts>>[number];
```

- [ ] **Step 4: Create `lib/queries/workAssignments.ts`**

```typescript
import { db } from "@/lib/db";

export async function getWorkAssignments(params?: {
  workLocationId?: string;
  workShiftId?: string;
  profileId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params?.workLocationId) where.workLocationId = params.workLocationId;
  if (params?.workShiftId) where.workShiftId = params.workShiftId;
  if (params?.profileId) where.profileId = params.profileId;

  return db.employeeWorkAssignment.findMany({
    where,
    select: {
      id: true,
      profileId: true,
      workLocationId: true,
      workShiftId: true,
      isDefault: true,
      effectiveDate: true,
      endDate: true,
      profile: { select: { id: true, fullName: true, avatarUrl: true, employeeNumber: true } },
      workLocation: { select: { id: true, name: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function getEmployeeActiveAssignments(profileId: string, date: Date) {
  return db.employeeWorkAssignment.findMany({
    where: {
      profileId,
      effectiveDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    include: {
      workLocation: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true, lateToleranceMinutes: true, isOvernight: true } },
    },
  });
}

export type WorkAssignmentItem = Awaited<ReturnType<typeof getWorkAssignments>>[number];
```

- [ ] **Step 5: Create `lib/queries/shiftOverrides.ts`**

```typescript
import { db } from "@/lib/db";

export async function getShiftOverrides(params?: {
  profileId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: Record<string, unknown> = {};
  if (params?.profileId) where.profileId = params.profileId;
  if (params?.startDate || params?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (params?.startDate) dateFilter.gte = params.startDate;
    if (params?.endDate) dateFilter.lte = params.endDate;
    where.date = dateFilter;
  }

  return db.shiftOverride.findMany({
    where,
    select: {
      id: true,
      profileId: true,
      date: true,
      workShiftId: true,
      workLocationId: true,
      reason: true,
      createdAt: true,
      profile: { select: { id: true, fullName: true, employeeNumber: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
      workLocation: { select: { id: true, name: true } },
      creator: { select: { id: true, fullName: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });
}

export type ShiftOverrideItem = Awaited<ReturnType<typeof getShiftOverrides>>[number];
```

- [ ] **Step 6: Update `lib/queries/attendance.ts`**

Update `getAttendanceToday` to include shift/location info:

```typescript
export async function getAttendanceToday(profileId: string) {
  const today = todayMidnightUTC();
  return db.attendance.findUnique({
    where: { profileId_date: { profileId, date: today } },
    include: {
      workLocation: { select: { id: true, name: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });
}
```

Update `getAttendanceList` to include location/shift in the include:

Replace the existing `include` block with:

```typescript
include: {
  profile: {
    select: { id: true, fullName: true, avatarUrl: true },
  },
  workLocation: { select: { id: true, name: true } },
  workShift: { select: { id: true, name: true } },
},
```

- [ ] **Step 7: Verify no TypeScript errors**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

---

### Task 4: Server Actions (Location, Shift, Assignment, Override, Global Settings)

**Files:**
- Create: `actions/workLocation.ts`
- Create: `actions/workShift.ts`
- Create: `actions/workAssignment.ts`
- Create: `actions/shiftOverride.ts`

These follow the exact same pattern as `actions/department.ts` and `actions/position.ts`:
- `"use server"` directive
- `requirePermission({ module: "hr-attendance", action: "..." })`
- `mutationLimiter.check()`
- Zod validation
- DB operation
- `logAudit()`
- `revalidateTag()`

Each action file has create, update, delete functions. `workAssignment.ts` additionally has `bulkCreateWorkAssignment`.

Key behaviors:
- `deleteWorkLocation`: blocked if `_count.assignments > 0`
- `deleteWorkShift`: blocked if `_count.assignments > 0`
- `bulkCreateWorkAssignment`: uses `db.$transaction(profileIds.map(id => db.employeeWorkAssignment.create(...)))` array form
- `createShiftOverride`/`updateShiftOverride`: uses `hr-attendance:edit` permission

The implementer should read `actions/department.ts` for the exact pattern and replicate it for each entity.

- [ ] **Step 1: Create `actions/workLocation.ts`** — CRUD with `hr-attendance` module permissions, revalidateTag "work-locations"
- [ ] **Step 2: Create `actions/workShift.ts`** — CRUD with `hr-attendance` module permissions, revalidateTag "work-shifts"
- [ ] **Step 3: Create `actions/workAssignment.ts`** — CRUD + bulk with `hr-attendance` module permissions, revalidateTag "work-assignments"
- [ ] **Step 4: Create `actions/shiftOverride.ts`** — CRUD with `hr-attendance:edit` permission, revalidateTag "shift-overrides"
- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 5: API Routes + Services + Hooks

**Files:**
- Create: `app/api/hr/work-locations/route.ts`
- Create: `app/api/hr/work-shifts/route.ts`
- Create: `app/api/hr/work-assignments/route.ts`
- Create: `app/api/hr/shift-overrides/route.ts`
- Create: `services/work-location-service.ts`
- Create: `services/work-shift-service.ts`
- Create: `services/work-assignment-service.ts`
- Create: `services/shift-override-service.ts`
- Create: `hooks/use-work-locations.ts`
- Create: `hooks/use-work-shifts.ts`
- Create: `hooks/use-work-assignments.ts`
- Create: `hooks/use-shift-overrides.ts`

All follow the exact same pattern as existing attendance endpoints/services/hooks. The implementer should read `app/api/hr/departments/route.ts`, `services/department-service.ts`, and `hooks/use-departments.ts` for the pattern.

API routes: auth + apiLimiter + query. Services: `fetch("/api/hr/...")`. Hooks: `useQuery` + `useMutation` wrappers.

- [ ] **Step 1: Create 4 API route files** — GET handlers for work-locations, work-shifts, work-assignments, shift-overrides
- [ ] **Step 2: Create 4 service files** — fetch wrappers
- [ ] **Step 3: Create 4 hook files** — TanStack Query hooks with CRUD mutations
- [ ] **Step 4: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 6: Update Clock-In/Clock-Out Routes

**Files:**
- Modify: `app/api/hr/attendance/clock-in/route.ts`
- Modify: `app/api/hr/attendance/clock-out/route.ts`
- Modify: `app/api/hr/attendance/settings/route.ts`
- Modify: `app/api/hr/attendance/today/route.ts`
- Modify: `hooks/use-attendance.ts`
- Modify: `services/attendance-service.ts`

- [ ] **Step 1: Rewrite `clock-in/route.ts`**

Replace the existing clock-in logic. The new flow:

1. Auth + rate limit (same)
2. Parse body (same)
3. **NEW: Resolve shift** via `resolveEmployeeShift(profileId, today)` from `@/lib/attendance-helpers`
4. If no shift resolved → 409 "Anda belum di-assign ke shift/lokasi kerja"
5. **NEW: Validate GPS** via `validateGpsAgainstLocations(profileId, lat, lng, today, resolved.workLocationId)` from `@/lib/attendance-helpers`
6. If GPS invalid → 403 with distance info
7. Check existing clock-in (same)
8. Upload photo (same)
9. **NEW: Determine status** via `determineStatus(now, shift.startTime, shift.lateToleranceMinutes, shift.isOvernight)` from `@/lib/attendance-helpers`
10. **NEW: Upsert with `workLocationId` and `workShiftId`** fields
11. Audit log (same)

Remove the inline `haversineDistance` and `determineStatus` functions (now in `attendance-helpers.ts`).

- [ ] **Step 2: Update `clock-out/route.ts`**

Replace GPS validation logic:
1. Get global settings for `requireClockOutLocation` flag
2. If `requireClockOutLocation` is true → validate GPS against employee's assigned locations (same helper)
3. If false → skip GPS validation entirely
4. Remove inline `haversineDistance` function

- [ ] **Step 3: Update `settings/route.ts`**

The PUT handler should accept both legacy schema (for backward compat) and the new `globalAttendanceSettingsSchema`. Add a secondary PUT path that accepts `{ defaultLateToleranceMinutes, requireClockOutLocation }` and updates only those fields.

Or simpler: keep existing PUT for legacy fields, add support for new fields in the same schema. The `attendanceSettingsSchema` already covers the old fields. Just add the new fields as optional to the existing schema.

- [ ] **Step 4: Update `today/route.ts`**

Add resolved shift info to the response. After getting the attendance record, also resolve the employee's shift for today and include it:

```typescript
import { resolveEmployeeShift } from "@/lib/attendance-helpers";

// After getting attendance record
const resolved = await resolveEmployeeShift(profileId, todayMidnightUTC());
return Response.json({
  attendance: result,
  shift: resolved?.workShift ?? null,
  locationSource: resolved?.source ?? null,
});
```

- [ ] **Step 5: Update `hooks/use-attendance.ts` and `services/attendance-service.ts`**

Add a hook/service for updating global attendance settings (separate from the legacy settings):

```typescript
// In services/attendance-service.ts
export async function updateGlobalAttendanceSettings(data: GlobalAttendanceSettingsInput) {
  const res = await fetch("/api/hr/attendance/settings/global", { method: "PUT", ... });
  ...
}

// In hooks/use-attendance.ts
export function useUpdateGlobalAttendanceSettings() { ... }
```

Or reuse the existing settings endpoint — the implementer should decide based on what's simplest.

- [ ] **Step 6: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 7: UI — Admin Settings Tabs (WorkLocation + WorkShift + Assignment + Override + GlobalSettings)

**Files:**
- Create: `app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkLocationManager.tsx`
- Create: `app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkShiftManager.tsx`
- Create: `app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkAssignmentManager.tsx`
- Create: `app/(private)/dashboard/hr/manajemen-kehadiran/_components/ShiftOverrideManager.tsx`
- Create: `app/(private)/dashboard/hr/manajemen-kehadiran/_components/GlobalSettingsPanel.tsx`
- Modify: `app/(private)/dashboard/hr/manajemen-kehadiran/page.tsx`

Each manager component follows the same pattern as `DepartmentManager.tsx` and `PositionManager.tsx` from the Database Karyawan module:
- Card with header + "Tambah" button (permission-gated)
- Table with data rows
- Add/Edit dialog
- Delete confirmation dialog (blocked if has dependencies)
- Loading skeleton + empty state

- [ ] **Step 1: Create `WorkLocationManager.tsx`**

Table columns: Nama, Alamat, Venue, Lat/Lng, Radius (m), Karyawan, Aksi.
Dialog fields: name, venueId (Select from venues via `/api/venues`), address, latitude, longitude, radiusMeters.
Uses `useWorkLocations()`, `useCreateWorkLocation()`, `useUpdateWorkLocation()`, `useDeleteWorkLocation()`.

- [ ] **Step 2: Create `WorkShiftManager.tsx`**

Table columns: Nama, Jam Mulai, Jam Selesai, Toleransi, Overnight, Karyawan, Aksi.
Dialog fields: name, startTime (time input), endTime (time input), lateToleranceMinutes, isOvernight (checkbox).
Uses `useWorkShifts()` + CRUD mutations.

- [ ] **Step 3: Create `WorkAssignmentManager.tsx`**

Table columns: Karyawan, Lokasi, Shift, Default, Berlaku Mulai, Berlaku Sampai, Aksi.
Filters: by location, by shift.
Dialog fields: profileId (SearchableSelect), workLocationId (Select), workShiftId (Select), isDefault (checkbox), effectiveDate, endDate.
"Bulk Assign" button opens a dialog with multi-select employees + location + shift.
Uses `useWorkAssignments()` + CRUD mutations. Uses `useEmployees()` for employee select.

- [ ] **Step 4: Create `ShiftOverrideManager.tsx`**

Date range picker at top. Table columns: Tanggal, Karyawan, Shift, Lokasi, Alasan, Dibuat Oleh, Aksi.
Dialog fields: profileId (SearchableSelect), date, workShiftId (Select), workLocationId (optional Select), reason.
Uses `useShiftOverrides()` + CRUD mutations.

- [ ] **Step 5: Create `GlobalSettingsPanel.tsx`**

Simple card with form:
- Default Late Tolerance (number input)
- Require Clock-Out Location (toggle/checkbox)
- Save button

Uses `useAttendanceSettings()` + `useUpdateAttendanceSettings()`.

- [ ] **Step 6: Update `manajemen-kehadiran/page.tsx`**

Restructure the page to use Tabs:

```tsx
<Tabs defaultValue="rekap">
  <TabsList>
    <TabsTrigger value="rekap">Rekap Kehadiran</TabsTrigger>
    <TabsTrigger value="lokasi">Lokasi Kerja</TabsTrigger>
    <TabsTrigger value="shift">Shift Kerja</TabsTrigger>
    <TabsTrigger value="assignment">Assignment</TabsTrigger>
    <TabsTrigger value="override">Override Shift</TabsTrigger>
    <TabsTrigger value="settings">Pengaturan</TabsTrigger>
  </TabsList>
  <TabsContent value="rekap"><AttendanceFilter /><AttendanceTable /></TabsContent>
  <TabsContent value="lokasi"><WorkLocationManager /></TabsContent>
  <TabsContent value="shift"><WorkShiftManager /></TabsContent>
  <TabsContent value="assignment"><WorkAssignmentManager /></TabsContent>
  <TabsContent value="override"><ShiftOverrideManager /></TabsContent>
  <TabsContent value="settings"><GlobalSettingsPanel /></TabsContent>
</Tabs>
```

Remove the old `AttendanceSettingsPanel` import.

- [ ] **Step 7: Verify page renders** — `npm run dev`, navigate to `/dashboard/hr/manajemen-kehadiran`

---

### Task 8: UI — Update AttendanceTable + Employee Absensi Page

**Files:**
- Modify: `app/(private)/dashboard/hr/manajemen-kehadiran/_components/AttendanceTable.tsx`
- Modify: `app/(private)/dashboard/hr/absensi/_components/AttendanceClock.tsx`

- [ ] **Step 1: Update `AttendanceTable.tsx`**

Add two columns after "Status":
- "Lokasi" → `record.workLocation?.name ?? "-"`
- "Shift" → `record.workShift?.name ?? "-"`

The data already includes these fields from the updated query in Task 3.

- [ ] **Step 2: Update `AttendanceClock.tsx`**

Before the Clock In button, show the employee's current shift info:
- Fetch resolved shift info from the updated `/api/hr/attendance/today` endpoint
- Display: "Shift: [name] ([startTime] - [endTime]) @ [location]"
- If override: show "Override: [shift name] — [reason]"
- If no assignment: show warning "Anda belum di-assign ke shift/lokasi"

After clock-in: show the detected location name.

- [ ] **Step 3: Verify** — `npx tsc --noEmit --skipLibCheck` + `npm run build`

---

### Task 9: Final Verification

- [ ] **Step 1: Run TypeScript check** — `npx tsc --noEmit --skipLibCheck`
- [ ] **Step 2: Run ESLint** — `npx eslint "app/(private)/dashboard/hr/**/*.tsx" "lib/**/*.ts" "actions/**/*.ts" --max-warnings 100`
- [ ] **Step 3: Run build** — `npm run build`
- [ ] **Step 4: Manual testing checklist**

1. `/dashboard/hr/manajemen-kehadiran` — tabs render
2. Lokasi Kerja tab — create location (with and without venue), edit, delete
3. Shift Kerja tab — create shift (normal + overnight), edit, delete
4. Assignment tab — assign employee to location+shift, bulk assign, edit, delete
5. Override tab — create override for specific date, edit, delete
6. Pengaturan tab — update global defaults
7. Rekap tab — new columns show location and shift
8. `/dashboard/hr/absensi` — shows shift info, clock-in validates against assigned location
