# Attendance Enhancement — Multi-Location & Shift Management Design Spec

**Date:** 2026-06-22
**Module:** HR & Payroll — Attendance Enhancement
**Status:** Approved
**Prerequisite:** Attendance module (Phase 1) — complete; Database Karyawan (Phase 2) — complete

---

## 1. Overview

Enhance the existing attendance system from a single-location, single-schedule model to support multiple work locations (tied to Venue or standalone) and multiple work shifts with per-employee assignment and daily overrides. This is a foundational change that supports future leave management and payslip modules.

### Current Limitations

- `AttendanceSettings` is a singleton — one GPS point, one work schedule for the entire company
- No concept of shifts (pagi/siang/malam)
- No concept of location assignment per employee
- All employees validated against the same GPS coordinates

### What Changes

- Multiple `WorkLocation` entities, each with its own GPS coordinates and radius
- Multiple `WorkShift` entities, each with its own schedule and late tolerance
- Employees assigned to location(s) + default shift via `EmployeeWorkAssignment`
- Daily shift overrides via `ShiftOverride` (swap shift, overtime, etc.)
- Clock-in validates GPS against all assigned locations, auto-detects nearest valid one
- Attendance records track which location and shift were used

---

## 2. Data Model

### 2.1 WorkLocation (New)

```prisma
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

- `venueId` nullable: when set, this location is tied to a Venue; when null, it's a custom location (HQ, warehouse, etc.)
- `radiusMeters`: geofence radius for GPS validation (10–5000m)
- A Venue can have multiple WorkLocations (e.g., lobby entrance, parking gate)

### 2.2 WorkShift (New)

```prisma
model WorkShift {
  id                     String    @id @default(uuid())
  name                   String
  startTime              String    // HH:MM format
  endTime                String    // HH:MM format
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

- `isOvernight`: true when shift crosses midnight (e.g., 23:00–07:00). Affects late calculation logic.
- `lateToleranceMinutes`: per-shift tolerance. Overrides any global default.

### 2.3 EmployeeWorkAssignment (New)

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

- `isDefault`: one assignment per employee should be marked as default. The default assignment determines which shift/location is used when there's no override.
- `effectiveDate` / `endDate`: supports time-bounded assignments (e.g., contract workers assigned to a venue for 3 months).

### 2.4 ShiftOverride (New)

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

- `@@unique([profileId, date])`: one override per employee per day
- `workLocationId` nullable: when null, the employee works their override shift at their default location
- `reason`: free text for admin notes ("tukar shift dengan Budi", "lembur event", etc.)

### 2.5 Attendance Model Changes

Add two nullable FK columns to the existing `Attendance` model:

```prisma
// Add to Attendance model
workLocationId  String?
workShiftId     String?

workLocation    WorkLocation? @relation(fields: [workLocationId], references: [id], onDelete: SetNull)
workShift       WorkShift?    @relation(fields: [workShiftId], references: [id], onDelete: SetNull)

@@index([workLocationId])
@@index([workShiftId])
```

Nullable because existing attendance records (pre-migration) won't have these values.

### 2.6 Profile Model Changes

Add reverse relations to Profile:

```prisma
// Add to Profile model
workAssignments        EmployeeWorkAssignment[]
shiftOverrides         ShiftOverride[]
shiftOverridesCreated  ShiftOverride[]  @relation("ShiftOverrideCreator")
```

### 2.7 Venue Model Changes

Add reverse relation to Venue:

```prisma
// Add to Venue model
workLocations  WorkLocation[]
```

### 2.8 AttendanceSettings Changes

Simplify to global defaults only (GPS fields become redundant since they move to WorkLocation):

**Keep:** `id`, `updatedAt`
**Add:** `defaultLateToleranceMinutes Int @default(15)` (fallback when shift doesn't specify tolerance)
**Add:** `requireClockOutLocation Boolean @default(false)` (whether clock-out also validates GPS)
**Deprecate (keep for migration):** `workStartTime`, `workEndTime`, `officeLatitude`, `officeLongitude`, `officeRadiusMeters`, `lateToleranceMinutes`

After migration data is moved to WorkLocation + WorkShift, the deprecated columns can remain unused but don't need to be removed (avoids breaking migration history).

---

## 3. Clock-In/Clock-Out Flow (Enhanced)

### 3.1 Clock-In Flow

1. Employee opens Absensi page, taps "Clock In"
2. Browser captures GPS coordinates + camera photo (same as current)
3. **Server receives** `{ photoBase64, lat, lng }`
4. **Resolve today's shift:**
   a. Check `ShiftOverride` for `(profileId, today)` → if exists, use override's shift (and location if specified)
   b. If no override → find `EmployeeWorkAssignment` where `isDefault = true` AND `effectiveDate <= today` AND (`endDate IS NULL` OR `endDate >= today`)
   c. If no assignment found → return error "Anda belum di-assign ke shift/lokasi kerja"
5. **Validate GPS against assigned locations:**
   a. Collect all `WorkLocation` IDs from employee's active assignments (not just default)
   b. If override specifies a location, validate only against that location
   c. Calculate distance from `(lat, lng)` to each location's `(latitude, longitude)`
   d. Find all locations where distance ≤ `radiusMeters`
   e. If none valid → return error "Anda berada di luar area lokasi kerja"
   f. Select the nearest valid location as `workLocationId`
6. **Calculate status:**
   - Compare clock-in time to `workShift.startTime + workShift.lateToleranceMinutes`
   - If `isOvernight` shift: adjust date boundary logic (shift starting at 23:00 means clock-in at 23:15 is still for "today's" shift)
   - Status: `on_time` or `late`
7. **Save Attendance record** with `workLocationId` and `workShiftId`
8. Upload photo to R2, audit log

### 3.2 Clock-Out Flow

1. Same GPS + photo capture
2. **GPS validation**: only if `AttendanceSettings.requireClockOutLocation` is true
3. Update existing Attendance record with clock-out data
4. Upload photo to R2, audit log

### 3.3 Edge Cases

- **No assignment**: employee cannot clock in → clear error message
- **Multiple valid locations**: pick the nearest one
- **Overnight shift**: shift starting at 23:00 on June 1 → clock-in between 22:45–23:15 on June 1 counts as June 1's shift
- **Override without location**: employee works their override shift but at their default assigned location(s)
- **Expired assignment** (`endDate` passed): assignment is inactive, not used for validation

---

## 4. UI Changes

### 4.1 Halaman Pengaturan Absensi (Admin — Enhanced)

Route: `/dashboard/hr/manajemen-kehadiran`

The existing `AttendanceSettingsPanel` component is replaced with a tabbed settings section:

#### Sub-tab: Lokasi Kerja
- Table: Name, Address, Venue (or "Custom"), Lat/Lng, Radius, Status, Actions
- "Tambah Lokasi" button → Dialog with:
  - Name (required)
  - Venue (optional Select from venues — auto-fills address, but lat/lng must be set manually)
  - Address (text)
  - Latitude, Longitude (number inputs)
  - Radius (number, default 100m)
- Edit/Delete per row (delete blocked if location has active assignments)

#### Sub-tab: Shift Kerja
- Table: Name, Jam Mulai, Jam Selesai, Toleransi, Overnight, Status, Actions
- "Tambah Shift" button → Dialog with:
  - Name (required, e.g., "Pagi")
  - Start Time (HH:MM)
  - End Time (HH:MM)
  - Late Tolerance Minutes (number, default 15)
  - Overnight toggle (for shifts crossing midnight)
- Edit/Delete per row (delete blocked if shift has active assignments)

#### Sub-tab: Assignment Karyawan
- Table: Karyawan, Lokasi, Shift, Default, Berlaku Mulai, Berlaku Sampai, Actions
- Filter by: Lokasi, Shift
- "Tambah Assignment" button → Dialog with:
  - Employee (SearchableSelect)
  - Location (Select)
  - Shift (Select)
  - Is Default (checkbox)
  - Effective Date (date)
  - End Date (optional date)
- Bulk assign: select multiple employees → assign to same location+shift
- Edit/Delete per row

#### Sub-tab: Override Shift
- Date picker at top (select date range to view)
- Table: Tanggal, Karyawan, Shift Override, Lokasi Override, Alasan, Dibuat Oleh, Actions
- "Tambah Override" button → Dialog with:
  - Employee (SearchableSelect)
  - Date (date picker)
  - Shift (Select)
  - Location (optional Select — blank = use default assignment location)
  - Reason (text)
- Edit/Delete per row

#### Sub-tab: Pengaturan Umum
- Default Late Tolerance (number) — fallback when shift doesn't define its own
- Require Clock-Out Location (toggle) — whether clock-out validates GPS

### 4.2 Halaman Absensi (Employee — Minor Change)

Route: `/dashboard/hr/absensi`

- Show employee's current assigned shift info: "Shift Pagi (07:00 - 15:00) @ Venue A"
- If override exists for today: show override info with reason
- Clock-in/out flow remains the same visually (GPS + camera)
- After clock-in: show which location was detected

### 4.3 Rekap Kehadiran (Admin Table — Enhanced)

- Add columns: "Lokasi" (work location name), "Shift" (shift name)
- Add filters: by location, by shift
- These columns are nullable (existing records show "-")

---

## 5. API Layer

### 5.1 New API Routes

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/hr/work-locations` | `hr-attendance:view` | List work locations |
| GET | `/api/hr/work-shifts` | `hr-attendance:view` | List work shifts |
| GET | `/api/hr/work-assignments` | `hr-attendance:view` | List assignments (filtered) |
| GET | `/api/hr/shift-overrides` | `hr-attendance:view` | List overrides (filtered by date range) |

### 5.2 New Server Actions

| Action | Permission | Description |
|---|---|---|
| `createWorkLocation` | `hr-attendance:create` | Create location |
| `updateWorkLocation` | `hr-attendance:edit` | Update location |
| `deleteWorkLocation` | `hr-attendance:delete` | Delete location (blocked if has assignments) |
| `createWorkShift` | `hr-attendance:create` | Create shift |
| `updateWorkShift` | `hr-attendance:edit` | Update shift |
| `deleteWorkShift` | `hr-attendance:delete` | Delete shift (blocked if has assignments) |
| `createWorkAssignment` | `hr-attendance:create` | Assign employee to location+shift |
| `updateWorkAssignment` | `hr-attendance:edit` | Update assignment |
| `deleteWorkAssignment` | `hr-attendance:delete` | Remove assignment |
| `bulkCreateWorkAssignment` | `hr-attendance:create` | Bulk assign employees |
| `createShiftOverride` | `hr-attendance:edit` | Create override |
| `updateShiftOverride` | `hr-attendance:edit` | Update override |
| `deleteShiftOverride` | `hr-attendance:edit` | Delete override |
| `updateGlobalAttendanceSettings` | `hr-attendance:edit` | Update global defaults |

### 5.3 Modified Endpoints

| Endpoint | Changes |
|---|---|
| `POST /api/hr/attendance/clock-in` | New shift resolution + multi-location GPS validation |
| `POST /api/hr/attendance/clock-out` | Optional GPS validation based on settings |
| `GET /api/hr/attendance` | Add `workLocationId`, `workShiftId` to response |
| `GET /api/hr/attendance/today` | Include resolved shift + location info |
| `GET /api/hr/attendance/settings` | Return new shape with global defaults |
| `PUT /api/hr/attendance/settings` | Accept new global settings shape |

---

## 6. Validation Schemas

### 6.1 `lib/validations/workLocation.ts`

```typescript
createWorkLocationSchema = {
  name: string.min(1),
  address: string?.optional(),
  venueId: string?.optional(),
  latitude: number (-90 to 90),
  longitude: number (-180 to 180),
  radiusMeters: int (10-5000, default 100),
}
```

### 6.2 `lib/validations/workShift.ts`

```typescript
createWorkShiftSchema = {
  name: string.min(1),
  startTime: string (HH:MM regex),
  endTime: string (HH:MM regex),
  lateToleranceMinutes: int (0-120, default 15),
  isOvernight: boolean (default false),
}
```

### 6.3 `lib/validations/workAssignment.ts`

```typescript
createWorkAssignmentSchema = {
  profileId: string,
  workLocationId: string,
  workShiftId: string,
  isDefault: boolean (default false),
  effectiveDate: date,
  endDate: date?.optional(),
}

bulkCreateWorkAssignmentSchema = {
  profileIds: string[].min(1),
  workLocationId: string,
  workShiftId: string,
  isDefault: boolean (default false),
  effectiveDate: date,
  endDate: date?.optional(),
}
```

### 6.4 `lib/validations/shiftOverride.ts`

```typescript
createShiftOverrideSchema = {
  profileId: string,
  date: date,
  workShiftId: string,
  workLocationId: string?.optional(),
  reason: string?.optional(),
}
```

### 6.5 Updated `lib/validations/attendance.ts`

Update `attendanceSettingsSchema`:

```typescript
globalAttendanceSettingsSchema = {
  defaultLateToleranceMinutes: int (0-120, default 15),
  requireClockOutLocation: boolean (default false),
}
```

---

## 7. Permissions (Seed via Migration)

```sql
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-attendance', 'view', 'View attendance settings, locations, shifts', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'create', 'Create locations, shifts, assignments', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'edit', 'Edit locations, shifts, assignments, overrides', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'delete', 'Delete locations, shifts', 20)
ON CONFLICT (module, action) DO NOTHING;
```

---

## 8. File Structure

```
lib/validations/workLocation.ts
lib/validations/workShift.ts
lib/validations/workAssignment.ts
lib/validations/shiftOverride.ts
lib/queries/workLocations.ts
lib/queries/workShifts.ts
lib/queries/workAssignments.ts
lib/queries/shiftOverrides.ts
actions/workLocation.ts
actions/workShift.ts
actions/workAssignment.ts
actions/shiftOverride.ts
services/work-location-service.ts
services/work-shift-service.ts
services/work-assignment-service.ts
services/shift-override-service.ts
hooks/use-work-locations.ts
hooks/use-work-shifts.ts
hooks/use-work-assignments.ts
hooks/use-shift-overrides.ts
app/api/hr/work-locations/route.ts
app/api/hr/work-shifts/route.ts
app/api/hr/work-assignments/route.ts
app/api/hr/shift-overrides/route.ts
app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkLocationManager.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkLocationDialog.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkShiftManager.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkShiftDialog.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkAssignmentManager.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/WorkAssignmentDialog.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/ShiftOverrideManager.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/ShiftOverrideDialog.tsx
app/(private)/dashboard/hr/manajemen-kehadiran/_components/GlobalSettingsPanel.tsx
```

Modified files:
```
prisma/schema.prisma — add models, update Attendance/Profile/Venue
prisma/migrations/YYYYMMDD_add_attendance_locations_shifts/migration.sql
lib/validations/attendance.ts — update settings schema
lib/queries/attendance.ts — update to include location/shift in responses
app/api/hr/attendance/clock-in/route.ts — new shift resolution + multi-location validation
app/api/hr/attendance/clock-out/route.ts — optional GPS validation
app/api/hr/attendance/settings/route.ts — new global settings shape
app/api/hr/attendance/today/route.ts — include shift/location info
app/(private)/dashboard/hr/manajemen-kehadiran/page.tsx — add settings tabs
app/(private)/dashboard/hr/manajemen-kehadiran/_components/AttendanceSettingsPanel.tsx — replace with tabbed settings
app/(private)/dashboard/hr/manajemen-kehadiran/_components/AttendanceTable.tsx — add location/shift columns
app/(private)/dashboard/hr/absensi/_components/* — show shift/location info
hooks/use-attendance.ts — update settings hooks
services/attendance-service.ts — update settings service
```

---

## 9. Migration Strategy

Single migration file. Must handle existing data:

1. **Create new tables:** `work_locations`, `work_shifts`, `employee_work_assignments`, `shift_overrides`
2. **Add columns to `attendance_settings`:** `defaultLateToleranceMinutes`, `requireClockOutLocation`
3. **Add columns to `attendances`:** `workLocationId`, `workShiftId` (nullable)
4. **Add FK constraints and indexes**
5. **Migrate existing data:**
   - Create one `WorkLocation` from existing `AttendanceSettings` GPS data (name: "Kantor Utama")
   - Create one `WorkShift` from existing `AttendanceSettings` schedule (name: "Reguler")
   - Copy `lateToleranceMinutes` to the created WorkShift
6. **Seed permissions**
7. **Add Venue relation** to work_locations (FK to venues)

All DDL uses `IF NOT EXISTS` / `IF EXISTS` for idempotency.

---

## 10. Key Design Decisions

1. **WorkLocation separate from Venue** — Venue is an event/booking entity. WorkLocation is an HR entity. They can be linked (`venueId` FK) but are independently managed. This avoids coupling event management with HR.

2. **Per-shift tolerance** — Each shift defines its own late tolerance rather than a single global value. This handles the reality that night shifts often need more flexibility than morning shifts.

3. **Assignment + Override pattern** — `EmployeeWorkAssignment` is the standing schedule; `ShiftOverride` is the exception. This keeps the common case simple (most employees work the same shift every day) while supporting flexibility.

4. **Auto-detect location on clock-in** — Rather than forcing employees to pick a location, GPS determines which assigned location they're at. This is faster and less error-prone.

5. **Nullable location/shift on Attendance** — Existing records predate the multi-location system. Making these fields nullable preserves backward compatibility without a complex backfill.

6. **AttendanceSettings preserved** — Rather than deleting the singleton, we keep it as global defaults. This maintains backward compatibility and provides fallback values.
