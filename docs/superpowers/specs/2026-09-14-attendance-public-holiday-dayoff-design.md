# Attendance: Public Holiday vs Day Off — Design

**Date:** 2026-09-14
**Branch:** `feat/manajemen-kehadiran-fix`
**Status:** Approved by user, ready for implementation plan

## Problem

The attendance/kehadiran module currently has no concept of Public Holiday
(tanggal merah, sourced from a master data table) or Day Off (weekly rest day
per employee schedule). These are two **separate, orthogonal** signals and
must never be conflated or used to infer one another. Critically, **neither
one exempts an employee from attendance** — clock-in/out is always required
regardless of `attendantType` (`WORKDAY`/`DAY_OFF`) or `isPublicHoliday`.
These fields only record the *condition* attendance happened under.

As of 2026-09-14, neither field nor a Public Holiday master table exists
anywhere in the codebase. `Attendance.status` is only
`on_time/late/absent/on_leave`. A weekly `offdayDays: Int[]` already exists
on `EmployeeWorkAssignment`, with a helper `isOffdayForDate()` in
`lib/attendance-offdays.ts`, but it is currently unused outside its own test
— it is not wired into any clock-in/out/gating logic.

## Goals

1. Add a `PublicHoliday` master data table, managed via a new Settings page.
2. Add `attendantType` (`WORKDAY`/`DAY_OFF`) and `isPublicHoliday` (boolean)
   to `Attendance`, frozen at clock-in time (snapshot pattern, consistent
   with ARCHITECTURE.md §4.1 — later edits to the holiday master or an
   employee's `offdayDays` must not retroactively change past records).
3. Surface both fields in rekap (`AttendanceTable`), export, and as an
   informational (non-blocking) badge on the employee clock-in screen.
4. Never gate/skip attendance based on either field.

## Non-goals

- No overtime/compensation logic tied to holiday or day-off work.
- No "cuti bersama" vs national holiday distinction (flat list, date + name
  only).
- No per-date Day Off override (e.g. via `ShiftOverride`) — MVP uses the
  existing weekly `offdayDays` only.
- No leave/cuti integration into `attendantType` — `DAY_OFF` is determined
  solely from the employee's weekly schedule.

## Schema changes

```prisma
model PublicHoliday {
  id        String   @id @default(uuid())
  date      DateTime @unique
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
  @@map("public_holidays")
}

enum AttendantType {
  WORKDAY
  DAY_OFF
}
```

`Attendance` gains:
```prisma
attendantType   AttendantType @default(WORKDAY)
isPublicHoliday Boolean       @default(false)
```

Migration SQL must be idempotent (`CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`) per AGENTS.md §6, committed together with the
schema change.

## Logic & data flow

### Public Holiday CRUD
Standard master-data slice, one file per domain:
- `lib/validations/publicHoliday.ts` — Zod schema (`date`, `name`)
- `lib/queries/publicHoliday.ts` — list/get (paginated)
- `actions/publicHoliday.ts` — create/update/delete, `"use server"`
- New permission module `settings-public-holiday` (`view/create/edit/delete`)
  added to `moduleActions` in `prisma/seeders/roles-permissions.ts`, left
  **unmapped** in `MODULE_REGISTRY` (`prisma/seeders/modules.ts`) so it
  resolves as a **general** settings item per ARCHITECTURE.md §5.
- Standard mutation order: `requirePermission` → `mutationLimiter.check` →
  Zod → write → `logAudit` → `revalidateTag("public-holidays", "max")`.
  Single-table writes, so `db.$transaction` is not required (per AGENTS.md
  §4.2, transactions are for multi-table writes).

### `resolveAttendanceContext` helper
New function in `lib/attendance-helpers.ts`, following the existing
`resolveEmployeeShift` pattern:

```ts
export async function resolveAttendanceContext(
  profileId: string,
  date: Date,
): Promise<{ attendantType: "WORKDAY" | "DAY_OFF"; isPublicHoliday: boolean }>
```

- `isPublicHoliday`: `db.publicHoliday.findUnique({ where: { date } })` on
  the same UTC-midnight `date` used for `Attendance.date`
  (`todayMidnightUTC()` convention).
- `attendantType`: resolves the employee's active `EmployeeWorkAssignment`
  (or override, matching `resolveEmployeeShift`'s existing lookup) and
  applies `isOffdayForDate(offdayDays, date)` → `DAY_OFF` if true, else
  `WORKDAY`.
- Both computed **independently** — never derived from each other.

### Wiring
- **Clock-in route** (`app/api/hr/attendance/clock-in/route.ts`): after
  `resolveEmployeeShift`, call `resolveAttendanceContext` and include both
  fields in the `db.attendance.upsert` create/update payload. Frozen from
  that point — clock-out does not recompute.
- **Clock-out route**: unchanged except it no longer needs to touch these
  fields (already set at clock-in).
- **Today route** (`app/api/hr/attendance/today/route.ts`): also calls
  `resolveAttendanceContext` to preview attendantType/isPublicHoliday
  *before* clock-in, for the informational badge. This preview is
  display-only and must never disable the clock-in action.

## UI changes

- New page `app/(private)/(general)/settings/public-holiday/page.tsx` +
  `_components/public-holiday-manager.tsx`, following the `event-types`
  page pattern (table + create/edit/delete dialog). Registered in the
  Settings hub (`app/(private)/(general)/settings/page.tsx` `GROUPS` array
  and `requirePagePermission([...])` list).
- `hooks/usePublicHoliday.ts` — TanStack Query wrapper (fetch + list hook +
  create/update/delete mutations, invalidate on success).
- `AttendanceTable.tsx` (rekap, `hrd/manajemen-kehadiran`): two new
  columns/badges — Hari Kerja/Libur Mingguan pill (`attendantType`) and
  Tanggal Merah yes/no badge (`isPublicHoliday`).
- `lib/attendance-export.ts` / `getAttendanceForExport`: select and include
  both new fields in the export output.
- `AttendanceClock.tsx` (`(general)/absensi`): informational badge sourced
  from the `today` route preview. Purely informational — clock-in button
  behavior is unchanged in every combination.

## Error handling

- No new error paths beyond standard Zod validation on the Public Holiday
  CRUD form (`date` required + valid, `name` required, non-empty).
- `resolveAttendanceContext` never throws for "no assignment found" — it
  defaults to `WORKDAY`/`false` when a `WorkAssignment` can't be resolved,
  consistent with clock-in's existing hard requirement that a shift/location
  assignment exists (a 409 is already returned upstream in that case, so
  `resolveAttendanceContext` is only reached once a valid assignment exists).

## Testing

- Unit tests for `resolveAttendanceContext` (new test file, mirroring
  `lib/attendance-offdays.test.ts`) covering all 4 combinations from the
  user's spec: WORKDAY/false, DAY_OFF/false, WORKDAY/true, DAY_OFF/true
  (public holiday landing on a weekly day off) — asserting the two fields
  are computed independently.
- Manual smoke test: seed a `PublicHoliday` row for today's date on a
  profile whose `offdayDays` includes today's weekday, clock in via the
  `/absensi` UI, confirm clock-in succeeds and the resulting `Attendance`
  row has `attendantType: DAY_OFF, isPublicHoliday: true`.
