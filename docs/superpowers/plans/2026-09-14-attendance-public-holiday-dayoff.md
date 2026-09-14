# Attendance: Public Holiday vs Day Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `PublicHoliday` master-data table and two new frozen fields on `Attendance` (`attendantType`: `WORKDAY`/`DAY_OFF`, `isPublicHoliday`: boolean) so the attendance module can record — but never gate on — whether a clock-in happened on a public holiday and/or the employee's weekly day off.

**Architecture:** Standard master-data CRUD slice (`lib/validations` → `lib/queries` → `actions` → `app/api` → `hooks` → Settings page), plus one new pure-resolution helper (`resolveAttendanceContext`) added to `lib/attendance-helpers.ts` that mirrors the existing `resolveEmployeeShift` pattern but queries `PublicHoliday` and `EmployeeWorkAssignment` independently. The two new `Attendance` fields are written once at clock-in (snapshot/freeze pattern per ARCHITECTURE.md §4.1) and never recomputed at clock-out or on read.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (PostgreSQL via Neon HTTP adapter), Zod v4, TanStack Query v5, `node:test`/`node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-14-attendance-public-holiday-dayoff-design.md`

## Global Constraints

- **Never gate or skip attendance** based on `attendantType` or `isPublicHoliday`. Clock-in/out is always mandatory regardless of their values. No task in this plan may add a check that blocks/hides the clock-in action based on these fields.
- Both fields are **frozen at clock-in** (snapshot pattern) — later edits to the `PublicHoliday` master or an employee's `offdayDays` must never retroactively change a past `Attendance` row. Clock-out does not recompute or touch them.
- `attendantType` and `isPublicHoliday` are computed **independently** — never infer one from the other.
- All migration SQL must be idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for enum/FK creation) per AGENTS.md §6.
- New permission module `settings-public-holiday` (`view`/`create`/`edit`/`delete`) is **unmapped** in `MODULE_REGISTRY` (`prisma/seeders/modules.ts`) — it must resolve as a **general** Settings item per ARCHITECTURE.md §5, not a world.
- Standard mutation order everywhere: `requirePermission`/`requirePermissionForRoute` → rate limiter (`mutationLimiter` for writes, `apiLimiter` for GET) → Zod → write → `logAudit` (only where the codebase's existing precedent for this exact slice — `actions/event-type.ts` — already does; that precedent does NOT call `logAudit`, so this plan follows it and does not add `logAudit` calls for Public Holiday CRUD, consistent with "follow existing patterns") → `revalidateTag(tag, "max")`.
- `db.$transaction([...])` array form only, no callback form (Neon HTTP limitation). Per the spec, Public Holiday CRUD is single-table, so `db.$transaction` wrapping is optional but used anyway for consistency with `actions/event-type.ts`'s established convention (which wraps even single-table writes in `db.$transaction([...])`).
- No `console.log` in runtime code (`console.error` only in catch blocks). No `any` — use `unknown` and narrow. Explicit return types on exported functions. `@/` import alias.
- Design system: monochrome + ink/gold/cream tokens only, Solar Icons `weight="BoldDuotone"`, no hardcoded hex, Tailwind v4 syntax (`data-attr:` not `data-[attr]:`, `text-x!` not `!text-x`).

---

### Task 1: Prisma schema + migration (PublicHoliday table, AttendantType enum, Attendance columns, permission seed)

**Files:**
- Modify: `prisma/schema.prisma` (enum block at line 723, `Attendance` model at lines 2223-2255, plus new `PublicHoliday` model appended near `Attendance`)
- Create: `prisma/migrations/20260914130000_add_public_holiday_and_attendant_type/migration.sql`

**Interfaces:**
- Produces: `db.publicHoliday` Prisma delegate (`id`, `date` unique, `name`, `isActive`, `createdAt`, `updatedAt`), `AttendantType` enum (`WORKDAY`/`DAY_OFF`) usable as a TS type via `Prisma.AttendantType` or the generated union, `Attendance.attendantType: AttendantType` (default `WORKDAY`), `Attendance.isPublicHoliday: boolean` (default `false`). New permission rows `(settings-public-holiday, view|create|edit|delete)` granted to `human-resource` and `manager` roles.

- [ ] **Step 1: Add `AttendantType` enum to `prisma/schema.prisma`**

Insert immediately after the `AttendanceStatus` enum (after line 728, before the blank line preceding `enum LeaveRequestStatus`):

```prisma
enum AttendanceStatus {
  on_time
  late
  absent
  on_leave
}

enum AttendantType {
  WORKDAY
  DAY_OFF
}
```

- [ ] **Step 2: Add `PublicHoliday` model to `prisma/schema.prisma`**

Insert directly after the `Attendance` model closes (after line 2255, before `model AttendanceSettings`):

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

```

- [ ] **Step 3: Add the two new columns to the `Attendance` model**

In `prisma/schema.prisma`, change lines 2238-2241 from:

```prisma
  status         AttendanceStatus @default(absent)
  workLocationId String?
  workShiftId    String?
```

to:

```prisma
  status          AttendanceStatus @default(absent)
  workLocationId  String?
  workShiftId     String?
  attendantType   AttendantType    @default(WORKDAY)
  isPublicHoliday Boolean          @default(false)
```

- [ ] **Step 4: Run `npx prisma validate`**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 5: Write the migration SQL file**

Create `prisma/migrations/20260914130000_add_public_holiday_and_attendant_type/migration.sql`:

```sql
-- ─── Public Holiday + Attendant Type ─────────────────────────────────────────
-- Adds:
--   - public_holidays master table (tanggal merah)
--   - AttendantType enum (WORKDAY / DAY_OFF)
--   - attendances.attendantType, attendances.isPublicHoliday (frozen at clock-in)
--   - settings-public-holiday permission (view/create/edit/delete)

-- CreateEnum: AttendantType (idempotent)
DO $$ BEGIN
  CREATE TYPE "AttendantType" AS ENUM ('WORKDAY', 'DAY_OFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: public_holidays
CREATE TABLE IF NOT EXISTS "public_holidays" (
  "id"        TEXT                     NOT NULL DEFAULT gen_random_uuid(),
  "date"      TIMESTAMP(3)             NOT NULL,
  "name"      TEXT                     NOT NULL,
  "isActive"  BOOLEAN                  NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)             NOT NULL,

  CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_holidays_date_key" ON "public_holidays"("date");
CREATE INDEX IF NOT EXISTS "public_holidays_date_idx" ON "public_holidays"("date");

-- AlterTable attendances: add attendantType + isPublicHoliday
ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "attendantType" "AttendantType" NOT NULL DEFAULT 'WORKDAY',
  ADD COLUMN IF NOT EXISTS "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false;

-- ─── Seed: settings-public-holiday permission ────────────────────────────────
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'settings-public-holiday', 'view',   'View public holiday list', 0),
  (gen_random_uuid()::text, 'settings-public-holiday', 'create', 'Create public holiday', 0),
  (gen_random_uuid()::text, 'settings-public-holiday', 'edit',   'Edit public holiday', 0),
  (gen_random_uuid()::text, 'settings-public-holiday', 'delete', 'Delete public holiday', 0)
ON CONFLICT (module, action) DO NOTHING;

-- Grant settings-public-holiday:* to human-resource role
DO $$
DECLARE
  hr_role_id text;
BEGIN
  SELECT id INTO hr_role_id FROM "roles" WHERE name = 'human-resource';
  IF hr_role_id IS NULL THEN
    RAISE NOTICE 'human-resource role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), hr_role_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'settings-public-holiday' AND p.action IN ('view', 'create', 'edit', 'delete')
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;

-- Grant settings-public-holiday:* to manager role
DO $$
DECLARE
  mgr_id text;
BEGIN
  SELECT id INTO mgr_id FROM "roles" WHERE name = 'manager';
  IF mgr_id IS NULL THEN
    RAISE NOTICE 'manager role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), mgr_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'settings-public-holiday' AND p.action IN ('view', 'create', 'edit', 'delete')
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;
```

- [ ] **Step 6: Apply the migration and regenerate the Prisma client**

Run: `npx prisma migrate dev --name add_public_holiday_and_attendant_type` (if `DATABASE_URL` is reachable in the dev environment) — this will detect the migration file already exists and just apply + regenerate. If the DB is unavailable in this environment, run `npx prisma generate` only, and note in the task's handoff that `migrate deploy` must run before this branch is merged/deployed.
Expected: Prisma Client regenerated with `db.publicHoliday`, `AttendantType`, and `Attendance.attendantType`/`Attendance.isPublicHoliday` available in types.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260914130000_add_public_holiday_and_attendant_type/migration.sql
git commit -m "feat(db): add PublicHoliday table and Attendance.attendantType/isPublicHoliday"
```

---

### Task 2: Permission seeder registration (dev/local consistency)

**Files:**
- Modify: `prisma/seeders/roles-permissions.ts:36` (insert into `moduleActions`), and `rolePermissionMap` entries for `human-resource` (line 266-270) and `manager` (line 131-151)

**Interfaces:**
- Consumes: nothing new.
- Produces: dev-seeder parity with the migration SQL from Task 1, so a fresh local DB seeded via `npm run db:seed` (not just `migrate deploy`) also gets the `settings-public-holiday` permission and role grants.

- [ ] **Step 1: Add the new module to `moduleActions`**

In `prisma/seeders/roles-permissions.ts`, change line 36 from:

```ts
  "settings-event-types": ["view", "create", "edit", "delete"],
```

to:

```ts
  "settings-event-types": ["view", "create", "edit", "delete"],
  "settings-public-holiday": ["view", "create", "edit", "delete"],
```

- [ ] **Step 2: Grant it to `human-resource` in `rolePermissionMap`**

In `prisma/seeders/roles-permissions.ts`, change the `"human-resource"` block (lines 266-270) from:

```ts
  "human-resource": {
    hr: ["view", "create", "edit", "delete", "approve"],
    "hr-recruitment": ["view", "create", "edit", "delete", "hire", "approve"],
    procurement: ["view"],
  },
```

to:

```ts
  "human-resource": {
    hr: ["view", "create", "edit", "delete", "approve"],
    "hr-recruitment": ["view", "create", "edit", "delete", "hire", "approve"],
    procurement: ["view"],
    "settings-public-holiday": ["view", "create", "edit", "delete"],
  },
```

- [ ] **Step 3: Grant it to `manager` in `rolePermissionMap`**

In `prisma/seeders/roles-permissions.ts`, in the `manager` block (lines 131-151), change:

```ts
    bitrix: ["view"],
    "internal-faq": ["view", "create", "edit", "delete"],
    announcement: ["view", "create", "edit", "delete"],
    "settings-booking-log": ["view"],
  },
```

(the closing lines of the `manager` block) to:

```ts
    bitrix: ["view"],
    "internal-faq": ["view", "create", "edit", "delete"],
    announcement: ["view", "create", "edit", "delete"],
    "settings-booking-log": ["view"],
    "settings-public-holiday": ["view", "create", "edit", "delete"],
  },
```

- [ ] **Step 4: Do NOT add `settings-public-holiday` to `prisma/seeders/modules.ts`**

No edit needed — leaving it out of `MODULE_REGISTRY.permissions` is what makes it resolve as a general Settings item (ARCHITECTURE.md §5). This step exists only to record the decision so no future task mistakenly adds it.

- [ ] **Step 5: Commit**

```bash
git add prisma/seeders/roles-permissions.ts
git commit -m "chore(seed): register settings-public-holiday permission for dev seeder parity"
```

---

### Task 3: Public Holiday validation, query, and server actions

**Files:**
- Create: `lib/validations/publicHoliday.ts`
- Create: `lib/queries/publicHoliday.ts`
- Create: `actions/publicHoliday.ts`

**Interfaces:**
- Produces:
  - `publicHolidaySchema: ZodObject` with `{ date: string, name: string }`, exported type `PublicHolidayInput`
  - `getPublicHolidays(): Promise<PublicHolidayItem[]>` — full active+inactive list (small reference table, no pagination needed per AGENTS.md's `findMany` pagination rule being about unbounded tables; this table is bounded to ~20-40 rows/year, mirrors `getEventTypes()`'s same `take: 500` bounded-list pattern)
  - `export type PublicHolidaysResult = Awaited<ReturnType<typeof getPublicHolidays>>`
  - `export type PublicHolidayItem = PublicHolidaysResult[number]`
  - `createPublicHoliday(data: unknown): Promise<{success: true, item: PublicHolidayItem} | {success: false, error: string}>`
  - `updatePublicHoliday(id: string, data: unknown): Promise<same shape>`
  - `deletePublicHoliday(id: string): Promise<{success: true} | {success: false, error: string}>`

- [ ] **Step 1: Write `lib/validations/publicHoliday.ts`**

```ts
import { z } from "zod";

export const publicHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  name: z.string().min(1, "Nama wajib diisi").max(100),
});

export type PublicHolidayInput = z.infer<typeof publicHolidaySchema>;
```

- [ ] **Step 2: Write `lib/queries/publicHoliday.ts`**

```ts
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPublicHolidays() {
  "use cache";
  cacheTag("public-holidays");
  cacheLife("minutes");

  return db.publicHoliday.findMany({
    select: { id: true, date: true, name: true, isActive: true, createdAt: true },
    orderBy: { date: "asc" },
    take: 500,
  });
}

export type PublicHolidaysResult = Awaited<ReturnType<typeof getPublicHolidays>>;
export type PublicHolidayItem = PublicHolidaysResult[number];
```

- [ ] **Step 3: Write `actions/publicHoliday.ts`**

```ts
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { publicHolidaySchema } from "@/lib/validations/publicHoliday";

function toMidnightUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function createPublicHoliday(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-public-holiday", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ph-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = publicHolidaySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.publicHoliday.create({
        data: { date: toMidnightUTC(parsed.data.date), name: parsed.data.name },
      }),
    ]);
    revalidateTag("public-holidays", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createPublicHoliday]", e);
    return { success: false, error: "Tanggal sudah terdaftar sebagai hari libur." };
  }
}

export async function updatePublicHoliday(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-public-holiday", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ph-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = publicHolidaySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.publicHoliday.update({
        where: { id },
        data: { date: toMidnightUTC(parsed.data.date), name: parsed.data.name },
      }),
    ]);
    revalidateTag("public-holidays", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[updatePublicHoliday]", e);
    return { success: false, error: "Gagal memperbarui. Tanggal mungkin sudah digunakan." };
  }
}

export async function deletePublicHoliday(id: string) {
  const { session, error } = await requirePermission({ module: "settings-public-holiday", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ph-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.publicHoliday.delete({ where: { id } })]);
    revalidateTag("public-holidays", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePublicHoliday]", e);
    return { success: false, error: "Gagal menghapus." };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `publicHoliday.ts` files (Task 1's Prisma client regen must already be done for `db.publicHoliday` to resolve).

- [ ] **Step 5: Commit**

```bash
git add lib/validations/publicHoliday.ts lib/queries/publicHoliday.ts actions/publicHoliday.ts
git commit -m "feat(hr): add Public Holiday validation, query, and server actions"
```

---

### Task 4: Public Holiday REST route + TanStack Query hook

**Files:**
- Create: `app/api/public-holiday/route.ts`
- Create: `hooks/usePublicHoliday.ts`

**Interfaces:**
- Consumes: `getPublicHolidays` from `lib/queries/publicHoliday.ts` (Task 3), `PublicHolidaysResult`/`PublicHolidayItem` types (Task 3), `createPublicHoliday`/`updatePublicHoliday`/`deletePublicHoliday` from `actions/publicHoliday.ts` (Task 3).
- Produces: `GET /api/public-holiday` (JSON array of `PublicHolidayItem`), `usePublicHolidays(): UseQueryResult<PublicHolidaysResult>` client hook for the manager component to refresh from.

- [ ] **Step 1: Write `app/api/public-holiday/route.ts`**

```ts
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPublicHolidays } from "@/lib/queries/publicHoliday";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-public-holiday",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`public-holiday:${session.user.id}`)) return rateLimitResponse();

  try {
    const items = await getPublicHolidays();
    return Response.json(items);
  } catch {
    return Response.json({ error: "Gagal mengambil data hari libur" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `hooks/usePublicHoliday.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicHolidaysResult } from "@/lib/queries/publicHoliday";

async function fetchPublicHolidays(): Promise<PublicHolidaysResult> {
  const res = await fetch("/api/public-holiday");
  if (!res.ok) throw new Error("Failed to fetch public holidays");
  return res.json();
}

export function usePublicHolidays() {
  return useQuery<PublicHolidaysResult>({
    queryKey: ["public-holidays"] as const,
    queryFn: fetchPublicHolidays,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/public-holiday/route.ts hooks/usePublicHoliday.ts
git commit -m "feat(hr): add Public Holiday REST route and TanStack Query hook"
```

---

### Task 5: Public Holiday Settings page + manager UI

**Files:**
- Create: `app/(private)/(general)/settings/public-holiday/page.tsx`
- Create: `app/(private)/(general)/settings/public-holiday/_components/public-holiday-manager.tsx`
- Create: `app/(private)/(general)/settings/public-holiday/_components/loading.tsx`
- Modify: `app/(private)/(general)/settings/page.tsx` (`GROUPS` "Business" array at line 88, `requirePagePermission` array at line 191)

**Interfaces:**
- Consumes: `getPublicHolidays`, `PublicHolidaysResult`, `PublicHolidayItem` (Task 3); `createPublicHoliday`, `updatePublicHoliday`, `deletePublicHoliday` (Task 3); `usePermissions()` hook (existing, `can(module, action)` + `isAdmin`); `requirePagePermission` (existing, `lib/require-page-permission.ts`); `PaginationBar` (existing, `components/shared/pagination-bar.tsx`).
- Produces: `EventTypeLoading`-equivalent `PublicHolidayLoading` component; `/settings/public-holiday` route registered in the Settings hub under "Business".

- [ ] **Step 1: Write `app/(private)/(general)/settings/public-holiday/_components/loading.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PublicHolidayLoading() {
  return (
    <div className="pb-6">
      <Card>
        <CardContent className="p-0">
          <div className={cn("flex", "items-center", "justify-between", "px-6", "pb-4", "border-b")}>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(private)/(general)/settings/public-holiday/page.tsx`**

```tsx
import { Suspense } from "react";
import { getPublicHolidays } from "@/lib/queries/publicHoliday";
import { PublicHolidayManager } from "./_components/public-holiday-manager";
import { PublicHolidayLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function PublicHolidaySettingsPage() {
  await requirePagePermission("settings-public-holiday");
  return (
    <Suspense fallback={<PublicHolidayLoading />}>
      <PublicHolidayContent />
    </Suspense>
  );
}

async function PublicHolidayContent() {
  const data = await getPublicHolidays();
  return <PublicHolidayManager initialData={data} />;
}
```

- [ ] **Step 3: Write `app/(private)/(general)/settings/public-holiday/_components/public-holiday-manager.tsx`**

```tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddCircle, PenNewSquare, TrashBinTrash, Refresh } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { createPublicHoliday, updatePublicHoliday, deletePublicHoliday } from "@/actions/publicHoliday";
import { usePermissions } from "@/hooks/use-permissions";
import type { PublicHolidaysResult, PublicHolidayItem } from "@/lib/queries/publicHoliday";
import { cn } from "@/lib/utils";

function formatDateID(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function toInputDate(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

interface Props {
  initialData: PublicHolidaysResult;
}

const ROWS_PER_PAGE = 10;

export function PublicHolidayManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [editingItem, setEditingItem] = useState<PublicHolidayItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PublicHolidayItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sortedItems = useMemo(() =>
    [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [items]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/public-holiday");
      if (res.ok) {
        const data = await res.json() as PublicHolidaysResult;
        setItems(data);
        toast.success("Data diperbarui.");
      } else {
        toast.error("Gagal memuat ulang data.");
      }
    } catch {
      toast.error("Gagal memuat ulang data.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const totalPages = Math.ceil(sortedItems.length / ROWS_PER_PAGE);
  const paginatedItems = sortedItems.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormDate("");
    setFormName("");
    setFormOpen(true);
  }

  function handleOpenEdit(item: PublicHolidayItem) {
    setEditingItem(item);
    setFormDate(toInputDate(item.date));
    setFormName(item.name);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formDate || !formName.trim()) return;
    setSaving(true);
    const payload = { date: formDate, name: formName.trim() };
    const result = editingItem
      ? await updatePublicHoliday(editingItem.id, payload)
      : await createPublicHoliday(payload);

    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }

    if (editingItem) {
      const updated = result.item as PublicHolidayItem;
      setItems((prev) => prev.map((i) => i.id === editingItem.id ? updated : i));
      toast.success("Berhasil diperbarui.");
    } else {
      const newItem = result.item as PublicHolidayItem;
      setItems((prev) => [...prev, newItem]);
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deletePublicHoliday(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <Card>
          <CardContent className="p-0">
            <div className={cn("flex", "flex-col", "sm:flex-row", "items-start", "sm:items-center", "justify-between", "px-4", "sm:px-6", "pb-4", "gap-3", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <h2 className={cn("text-base", "font-bold", "text-foreground")}>Hari Libur Nasional</h2>
                <span className={cn("text-sm", "text-muted-foreground")}>({items.length})</span>
              </div>
              <div className={cn("flex", "items-center", "gap-2")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={cn("h-9", "w-9", "p-0", "cursor-pointer")}
                  aria-label="Refresh"
                >
                  <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", refreshing && "animate-spin")} />
                </Button>
                {(can("settings-public-holiday", "create") || isAdmin) && (
                  <Button onClick={handleOpenAdd} className={cn("cursor-pointer")}>
                    <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-2")} /> Tambah
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {paginatedItems.length === 0 ? (
                <div className={cn("text-center", "py-8", "text-muted-foreground", "text-sm")}>Belum ada data.</div>
              ) : (
                paginatedItems.map((item, idx) => (
                  <Card key={item.id} className="rounded-lg border bg-card shadow-none">
                    <CardContent className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}. {item.name}
                        </p>
                        <span className={cn("inline-flex", "items-center", "rounded-md", "bg-secondary", "px-2", "py-0.5", "text-xs", "font-medium", "shrink-0")}>
                          {formatDateID(item.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(can("settings-public-holiday", "edit") || isAdmin) && (
                          <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                          </button>
                        )}
                        {(can("settings-public-holiday", "delete") || isAdmin) && (
                          <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop/tablet: table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={cn("w-12", "px-4", "sm:px-6")}>#</TableHead>
                    <TableHead className="w-40">Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className={cn("text-center", "py-8", "text-muted-foreground")}>
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className={cn("px-4", "sm:px-6", "text-muted-foreground")}>
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex", "items-center", "rounded-md", "bg-secondary", "px-2", "py-0.5", "text-xs", "font-medium")}>
                            {formatDateID(item.date)}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <div className={cn("flex", "items-center", "gap-1", "justify-end", "pr-2")}>
                            {(can("settings-public-holiday", "edit") || isAdmin) && (
                              <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                                <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                              </button>
                            )}
                            {(can("settings-public-holiday", "delete") || isAdmin) && (
                              <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                                <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                label="Navigasi halaman hari libur"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Hari Libur</DialogTitle>
          <div className={cn("space-y-4", "pt-2")}>
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Hari Kemerdekaan RI"
              />
            </div>
            <div className={cn("flex", "gap-3")}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn("flex-1", "cursor-pointer")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formDate || !formName.trim()} className={cn("flex-1", "cursor-pointer")}>
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Hari Libur</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong> ({deleteTarget ? formatDateID(deleteTarget.date) : ""})? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 4: Register the page in the Settings hub**

In `app/(private)/(general)/settings/page.tsx`, add the `CalendarMark` import is already present (used by Event Types) — reuse it, or import a distinct icon `CalendarDate` from `@solar-icons/react`. Add to the top-level import block (after `CalendarMark,` on line 15):

```tsx
  CalendarMark,
  CalendarDate,
```

Then add a new item to the `"Business"` group's `items` array, immediately after the `"Event Types"` entry (after line 158, before the closing `],` of that group's items array):

```tsx
      {
        title: "Event Types",
        description: "Kelola tipe acara (Resepsi, Akad & Resepsi, dll) untuk nomor PO.",
        icon: CalendarMark,
        href: "/settings/event-types",
        module: "settings-event-types",
      },
      {
        title: "Hari Libur Nasional",
        description: "Kelola daftar tanggal merah / hari libur nasional.",
        icon: CalendarDate,
        href: "/settings/public-holiday",
        module: "settings-public-holiday",
      },
```

Then add `"settings-public-holiday"` to the `requirePagePermission([...])` array (line 191-203), after `"settings-event-types",`:

```tsx
  await requirePagePermission([
    "settings-users", "settings-brands", "settings-venues",
    "settings-role-permission", "settings-payment-methods",
    "settings-source-of-information", "settings-education-level",
    "settings-event-types", "settings-public-holiday", "settings-order-status",
    "settings-quotation-templates", "settings-tutorial",
    "settings-role-permission",
    "settings-daily-activity-segment",
    "settings-maintenance-category",
    "settings-maintenance-priority",
    "settings-maintenance-status",
    "settings-booking-log",
  ]);
```

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors. If `CalendarDate` does not exist in `@solar-icons/react`, substitute with a confirmed-available Solar icon name (check `node_modules/@solar-icons/react` exports) — do not guess further than the swap; `CalendarMark` (already imported and used) is a safe fallback icon to reuse for this item if `CalendarDate` doesn't resolve.

- [ ] **Step 6: Commit**

```bash
git add "app/(private)/(general)/settings/public-holiday" "app/(private)/(general)/settings/page.tsx"
git commit -m "feat(hr): add Public Holiday Settings page and manager UI"
```

---

### Task 6: `resolveAttendanceContext` helper + unit tests

**Files:**
- Modify: `lib/attendance-helpers.ts` (append new function after `resolveEmployeeShift`, i.e. after line 82)
- Create: `lib/attendance-context.test.ts`

**Interfaces:**
- Consumes: `db` from `lib/db.ts`, `isOffdayForDate` from `lib/attendance-offdays.ts`.
- Produces:
  ```ts
  export async function resolveAttendanceContext(
    profileId: string,
    date: Date,
  ): Promise<{ attendantType: "WORKDAY" | "DAY_OFF"; isPublicHoliday: boolean }>
  ```
  Consumed by Task 7 (clock-in route) and Task 8 (today route).

- [ ] **Step 1: Add `resolveAttendanceContext` to `lib/attendance-helpers.ts`**

Add this import at the top of `lib/attendance-helpers.ts` (alongside the existing `db` import):

```ts
import { isOffdayForDate } from "@/lib/attendance-offdays";
```

Insert the new function directly after `resolveEmployeeShift` closes (after line 82, before the `LocationValidationResult` interface):

```ts
export interface AttendanceContext {
  attendantType: "WORKDAY" | "DAY_OFF";
  isPublicHoliday: boolean;
}

export async function resolveAttendanceContext(profileId: string, date: Date): Promise<AttendanceContext> {
  const [holiday, assignment] = await Promise.all([
    db.publicHoliday.findUnique({
      where: { date },
      select: { id: true },
    }),
    db.employeeWorkAssignment.findFirst({
      where: {
        profileId,
        isDefault: true,
        effectiveDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      select: { offdayDays: true },
    }),
  ]);

  const attendantType: "WORKDAY" | "DAY_OFF" =
    assignment && isOffdayForDate(assignment.offdayDays, date) ? "DAY_OFF" : "WORKDAY";

  return {
    attendantType,
    isPublicHoliday: holiday !== null,
  };
}
```

Note: `attendantType` defaults to `"WORKDAY"` whenever no active `EmployeeWorkAssignment` is found — it never throws. This matches the spec's error-handling section: clock-in already returns a 409 upstream if no assignment exists (via `resolveEmployeeShift`), so `resolveAttendanceContext` reaching a "no assignment" state without throwing is a safe, intentional default only relevant to the `today` route's pre-clock-in preview.

- [ ] **Step 2: Write the failing tests first — `lib/attendance-context.test.ts`**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { resolveAttendanceContext } from "./attendance-helpers";
import { db } from "./db";

function mockOnce<T extends object, K extends keyof T>(obj: T, key: K, impl: T[K]) {
  const original = obj[key];
  obj[key] = impl;
  return () => { obj[key] = original; };
}

test("resolveAttendanceContext: WORKDAY + not a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => null) as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z")); // Tuesday
    assert.deepEqual(result, { attendantType: "WORKDAY", isPublicHoliday: false });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: DAY_OFF + not a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => null) as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-19T00:00:00.000Z")); // Saturday
    assert.deepEqual(result, { attendantType: "DAY_OFF", isPublicHoliday: false });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: WORKDAY + is a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => ({ id: "h1" })) as unknown as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z")); // Tuesday, holiday
    assert.deepEqual(result, { attendantType: "WORKDAY", isPublicHoliday: true });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: DAY_OFF + is a holiday (independent computation)", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => ({ id: "h1" })) as unknown as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-19T00:00:00.000Z")); // Saturday, holiday
    assert.deepEqual(result, { attendantType: "DAY_OFF", isPublicHoliday: true });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: no assignment found defaults to WORKDAY", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => null) as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => null) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z"));
    assert.deepEqual(result, { attendantType: "WORKDAY", isPublicHoliday: false });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});
```

- [ ] **Step 3: Run the tests to verify they fail before the implementation exists**

Run: `node --import tsx --test lib/attendance-context.test.ts` (match whichever `node:test` runner invocation `lib/attendance-offdays.test.ts` uses in `package.json`'s `test` script — check `package.json` for the exact script name, e.g. `npm test` or `npm run test:unit`, and use that instead if it differs)
Expected: FAIL — `resolveAttendanceContext` is not yet exported (if Step 1 hasn't been applied yet in a strict TDD ordering) or the mocks don't match real behavior yet.

Note: Because `db` is a Prisma Client singleton (not natively mockable without a DI seam), this task's step ordering is pragmatic rather than strict red-green TDD: Step 1 (implementation) and Step 2 (tests) both need to exist before Step 3 can meaningfully run. Write Step 1 first, then Step 2, then run Step 3 to confirm the tests pass against the real implementation — if `db.publicHoliday.findUnique` or `db.employeeWorkAssignment.findFirst` are read-only getters on the generated client and reassignment throws, replace the `mockOnce` approach with a thin wrapper: extract the two `db` calls in `resolveAttendanceContext` into two exported one-line functions (`findHolidayForDate`, `findActiveAssignment`) in the same file, and have the tests mock those exported functions via `node:test`'s `t.mock.method` instead of touching `db` directly.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test lib/attendance-context.test.ts` (or the project's actual test command)
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/attendance-helpers.ts lib/attendance-context.test.ts
git commit -m "feat(hr): add resolveAttendanceContext helper with unit tests"
```

---

### Task 7: Wire `resolveAttendanceContext` into clock-in

**Files:**
- Modify: `app/api/hr/attendance/clock-in/route.ts`

**Interfaces:**
- Consumes: `resolveAttendanceContext` from `lib/attendance-helpers.ts` (Task 6).
- Produces: `db.attendance.upsert(...)` now writes `attendantType`/`isPublicHoliday` on both create and update, frozen at the moment of clock-in.

- [ ] **Step 1: Import `resolveAttendanceContext`**

In `app/api/hr/attendance/clock-in/route.ts`, change the existing import line:

```ts
import { resolveEmployeeShift, validateGpsAgainstLocations, determineStatus } from "@/lib/attendance-helpers";
```

to:

```ts
import { resolveEmployeeShift, validateGpsAgainstLocations, determineStatus, resolveAttendanceContext } from "@/lib/attendance-helpers";
```

- [ ] **Step 2: Call `resolveAttendanceContext` after `determineStatus`, before the upsert**

Find the block:

```ts
      const status = determineStatus(
        now,
        resolved.workShift.startTime,
        resolved.workShift.lateToleranceMinutes,
        resolved.workShift.isOvernight,
      );
```

Add immediately after it:

```ts

      const context = await resolveAttendanceContext(profileId, today);
```

- [ ] **Step 3: Add both fields to the upsert's `create` and `update` payloads**

Find the `db.attendance.upsert` call's `create` block:

```ts
          create: {
            profileId,
            date: today,
            clockInAt: now,
            clockInPhotoUrl: photoUrl,
            clockInLat: parsed.data.lat,
            clockInLng: parsed.data.lng,
            status,
            workLocationId: gpsResult.nearestLocationId,
            workShiftId: resolved.workShiftId,
          },
```

Change to:

```ts
          create: {
            profileId,
            date: today,
            clockInAt: now,
            clockInPhotoUrl: photoUrl,
            clockInLat: parsed.data.lat,
            clockInLng: parsed.data.lng,
            status,
            workLocationId: gpsResult.nearestLocationId,
            workShiftId: resolved.workShiftId,
            attendantType: context.attendantType,
            isPublicHoliday: context.isPublicHoliday,
          },
```

Find the `update` block:

```ts
          update: {
            clockInAt: now,
            clockInPhotoUrl: photoUrl,
            clockInLat: parsed.data.lat,
            clockInLng: parsed.data.lng,
            status,
            workLocationId: gpsResult.nearestLocationId,
            workShiftId: resolved.workShiftId,
          },
```

Change to:

```ts
          update: {
            clockInAt: now,
            clockInPhotoUrl: photoUrl,
            clockInLat: parsed.data.lat,
            clockInLng: parsed.data.lng,
            status,
            workLocationId: gpsResult.nearestLocationId,
            workShiftId: resolved.workShiftId,
            attendantType: context.attendantType,
            isPublicHoliday: context.isPublicHoliday,
          },
```

Do NOT modify the existing `requirePermissionForRoute({ module: "attendance", action: "view" })` check at the top of the file — it is out of scope for this plan (legacy permission check, unrelated to this feature).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke test (documented, not automated — route touches GPS/photo upload/session)**

Per the spec's testing section: seed a `PublicHoliday` row for today's date, on a profile whose `EmployeeWorkAssignment.offdayDays` includes today's UTC weekday, clock in via the `/absensi` UI, and confirm the resulting `Attendance` row has `attendantType: "DAY_OFF"` and `isPublicHoliday: true`. Run this manually after Task 9 (UI badge) lands, since it's easiest to verify visually at that point — flag it as a checklist item to run before declaring the whole plan done, not a per-task automated step.

- [ ] **Step 6: Commit**

```bash
git add app/api/hr/attendance/clock-in/route.ts
git commit -m "feat(hr): freeze attendantType/isPublicHoliday into Attendance at clock-in"
```

---

### Task 8: Wire `resolveAttendanceContext` into the today route (pre-clock-in preview)

**Files:**
- Modify: `app/api/hr/attendance/today/route.ts`

**Interfaces:**
- Consumes: `resolveAttendanceContext` from `lib/attendance-helpers.ts` (Task 6).
- Produces: `GET /api/hr/attendance/today` response gains a `context: { attendantType, isPublicHoliday } | null` key — `null` only if `resolveAttendanceContext` isn't reached (it always resolves, per Task 6's no-throw guarantee, so in practice this is always present). This preview must not disable/hide clock-in in the consuming UI (Task 9).

- [ ] **Step 1: Import `resolveAttendanceContext`**

In `app/api/hr/attendance/today/route.ts`, change:

```ts
import { resolveEmployeeShift } from "@/lib/attendance-helpers";
```

to:

```ts
import { resolveEmployeeShift, resolveAttendanceContext } from "@/lib/attendance-helpers";
```

- [ ] **Step 2: Add `resolveAttendanceContext` as a third parallel call**

Change:

```ts
        const today = todayMidnightUTC();
        const [attendance, resolved] = await Promise.all([
          getAttendanceToday(profileId),
          resolveEmployeeShift(profileId, today),
        ]);

        return Response.json({
          attendance,
          shift: resolved?.workShift ?? null,
          shiftSource: resolved?.source ?? null,
        });
```

to:

```ts
        const today = todayMidnightUTC();
        const [attendance, resolved, context] = await Promise.all([
          getAttendanceToday(profileId),
          resolveEmployeeShift(profileId, today),
          resolveAttendanceContext(profileId, today),
        ]);

        return Response.json({
          attendance,
          shift: resolved?.workShift ?? null,
          shiftSource: resolved?.source ?? null,
          context,
        });
```

Note: `context` is returned unconditionally, regardless of whether `attendance` already exists (i.e. the employee already clocked in today). When `attendance` is non-null, the UI (Task 9) must prefer the frozen `attendance.attendantType`/`attendance.isPublicHoliday` over this preview `context` — the preview is only meaningful pre-clock-in. This distinction is documented here because `today/route.ts` has no branching logic itself; the branching belongs to the consuming component.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/hr/attendance/today/route.ts
git commit -m "feat(hr): surface resolveAttendanceContext preview on the today route"
```

---

### Task 9: Export wiring (`getAttendanceForExport` + `attendance-export.ts`)

**Files:**
- Modify: `lib/queries/attendance.ts` (the `select` block inside `getAttendanceForExport`, around lines 138-147)
- Modify: `lib/attendance-export.ts`

**Interfaces:**
- Consumes: `AttendanceExportItem` type (re-derived automatically from the modified `select`).
- Produces: `buildRows()` includes `attendantType`/`isPublicHoliday` labels; `exportToExcel`/`exportToPDF` include the two new columns.

- [ ] **Step 1: Add the two fields to `getAttendanceForExport`'s `select`**

In `lib/queries/attendance.ts`, find:

```ts
    select: {
      id: true,
      date: true,
      clockInAt: true,
      clockOutAt: true,
      status: true,
      profile: { select: { fullName: true } },
      workLocation: { select: { name: true } },
      workShift: { select: { name: true } },
    },
```

Change to:

```ts
    select: {
      id: true,
      date: true,
      clockInAt: true,
      clockOutAt: true,
      status: true,
      attendantType: true,
      isPublicHoliday: true,
      profile: { select: { fullName: true } },
      workLocation: { select: { name: true } },
      workShift: { select: { name: true } },
    },
```

- [ ] **Step 2: Add label maps and extend `buildRows()` in `lib/attendance-export.ts`**

Change:

```ts
const STATUS_LABEL: Record<string, string> = {
  on_time: "Hadir", late: "Terlambat", absent: "Absen", on_leave: "Cuti",
};
```

to:

```ts
const STATUS_LABEL: Record<string, string> = {
  on_time: "Hadir", late: "Terlambat", absent: "Absen", on_leave: "Cuti",
};

const ATTENDANT_TYPE_LABEL: Record<string, string> = {
  WORKDAY: "Hari Kerja", DAY_OFF: "Libur Mingguan",
};
```

Change `buildRows()` from:

```ts
function buildRows(data: AttendanceExportItem[]) {
  return data.map((r, i) => ({
    no: i + 1,
    nama: r.profile.fullName ?? "-",
    tanggal: formatDateID(r.date),
    clockIn: formatTimeShort(r.clockInAt),
    clockOut: formatTimeShort(r.clockOutAt),
    status: STATUS_LABEL[r.status] ?? r.status,
    lokasi: r.workLocation?.name ?? "-",
    shift: r.workShift?.name ?? "-",
  }));
}
```

to:

```ts
function buildRows(data: AttendanceExportItem[]) {
  return data.map((r, i) => ({
    no: i + 1,
    nama: r.profile.fullName ?? "-",
    tanggal: formatDateID(r.date),
    clockIn: formatTimeShort(r.clockInAt),
    clockOut: formatTimeShort(r.clockOutAt),
    status: STATUS_LABEL[r.status] ?? r.status,
    lokasi: r.workLocation?.name ?? "-",
    shift: r.workShift?.name ?? "-",
    tipeHari: ATTENDANT_TYPE_LABEL[r.attendantType] ?? r.attendantType,
    tanggalMerah: r.isPublicHoliday ? "Ya" : "Tidak",
  }));
}
```

- [ ] **Step 3: Extend `exportToExcel`**

Change:

```ts
export function exportToExcel(data: AttendanceExportItem[], period: string): void {
  const rows = buildRows(data).map((r) => ({
    No: r.no, "Nama Karyawan": r.nama, Tanggal: r.tanggal, "Clock In": r.clockIn,
    "Clock Out": r.clockOut, Status: r.status, Lokasi: r.lokasi, Shift: r.shift,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 16 }];
```

to:

```ts
export function exportToExcel(data: AttendanceExportItem[], period: string): void {
  const rows = buildRows(data).map((r) => ({
    No: r.no, "Nama Karyawan": r.nama, Tanggal: r.tanggal, "Clock In": r.clockIn,
    "Clock Out": r.clockOut, Status: r.status, Lokasi: r.lokasi, Shift: r.shift,
    "Tipe Hari": r.tipeHari, "Tanggal Merah": r.tanggalMerah,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
```

- [ ] **Step 4: Extend `exportToPDF`**

Change the `autoTable` call from:

```ts
      autoTable(doc, {
        startY: 35,
        head: [["No", "Nama Karyawan", "Tanggal", "Clock In", "Clock Out", "Status", "Lokasi", "Shift"]],
        body: rows.map((r) => [r.no, r.nama, r.tanggal, r.clockIn, r.clockOut, r.status, r.lokasi, r.shift]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [15, 65, 89] as [number, number, number], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        columnStyles: { 0: {cellWidth:10}, 1: {cellWidth:45}, 2: {cellWidth:28}, 3: {cellWidth:20}, 4: {cellWidth:20}, 5: {cellWidth:22}, 6: {cellWidth:38}, 7: {cellWidth:30} },
      });
```

to:

```ts
      autoTable(doc, {
        startY: 35,
        head: [["No", "Nama Karyawan", "Tanggal", "Clock In", "Clock Out", "Status", "Lokasi", "Shift", "Tipe Hari", "Tanggal Merah"]],
        body: rows.map((r) => [r.no, r.nama, r.tanggal, r.clockIn, r.clockOut, r.status, r.lokasi, r.shift, r.tipeHari, r.tanggalMerah]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [15, 65, 89] as [number, number, number], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        columnStyles: { 0: {cellWidth:8}, 1: {cellWidth:38}, 2: {cellWidth:24}, 3: {cellWidth:16}, 4: {cellWidth:16}, 5: {cellWidth:18}, 6: {cellWidth:30}, 7: {cellWidth:24}, 8: {cellWidth:20}, 9: {cellWidth:20} },
      });
```

(font size dropped from 8→7 and cell padding 3→2 to fit two more columns on the existing page width without changing `orientation`/page size — check the surrounding `doc` setup a few lines above `autoTable`, e.g. `new jsPDF(...)`, and leave its orientation untouched unless it's already portrait on a wide table, in which case widen to `"landscape"` if not already set.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — `AttendanceExportItem` picks up `attendantType`/`isPublicHoliday` automatically from the `select` change in Step 1 since it's a type alias derived via `Awaited<ReturnType<typeof getAttendanceForExport>>[number]`.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/attendance.ts lib/attendance-export.ts
git commit -m "feat(hr): include attendantType/isPublicHoliday in attendance export"
```

---

### Task 10: Rekap table columns (`AttendanceTable.tsx`)

**Files:**
- Modify: `app/(private)/hrd/manajemen-kehadiran/_components/AttendanceTable.tsx`

**Interfaces:**
- Consumes: `AttendanceListItem` type (already includes `attendantType`/`isPublicHoliday` automatically — `getAttendanceList` in `lib/queries/attendance.ts` uses Prisma `include`, which returns all `Attendance` scalar fields with no query-layer change needed).
- Produces: two new table columns/badges, no new props, no new hooks.

- [ ] **Step 1: Add label/badge helpers**

In `app/(private)/hrd/manajemen-kehadiran/_components/AttendanceTable.tsx`, change:

```tsx
const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  on_time: { label: "Hadir", variant: "default" },
  late: { label: "Terlambat", variant: "secondary" },
  absent: { label: "Absen", variant: "destructive" },
};
```

to:

```tsx
const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  on_time: { label: "Hadir", variant: "default" },
  late: { label: "Terlambat", variant: "secondary" },
  absent: { label: "Absen", variant: "destructive" },
};

const ATTENDANT_TYPE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  WORKDAY: { label: "Hari Kerja", variant: "outline" },
  DAY_OFF: { label: "Libur Mingguan", variant: "secondary" },
};
```

- [ ] **Step 2: Add two table headers**

Change:

```tsx
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead className="w-16">Foto</TableHead>
                    </TableRow>
```

to:

```tsx
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Tipe Hari</TableHead>
                      <TableHead>Tanggal Merah</TableHead>
                      <TableHead className="w-16">Foto</TableHead>
                    </TableRow>
```

- [ ] **Step 3: Render the two new cells per row**

Change:

```tsx
                          <TableCell>{record.workLocation?.name ?? "-"}</TableCell>
                          <TableCell>{record.workShift?.name ?? "-"}</TableCell>
                          <TableCell>
                            {(record.clockInPhotoUrl || record.clockOutPhotoUrl) && (
```

to:

```tsx
                          <TableCell>{record.workLocation?.name ?? "-"}</TableCell>
                          <TableCell>{record.workShift?.name ?? "-"}</TableCell>
                          <TableCell>
                            {(() => {
                              const atBadge = ATTENDANT_TYPE_BADGE[record.attendantType] ?? ATTENDANT_TYPE_BADGE.WORKDAY;
                              return <Badge variant={atBadge.variant}>{atBadge.label}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>
                            {record.isPublicHoliday ? (
                              <Badge variant="destructive">Ya</Badge>
                            ) : (
                              <Badge variant="outline">Tidak</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {(record.clockInPhotoUrl || record.clockOutPhotoUrl) && (
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — `AttendanceListItem` (exported from `lib/queries/attendance.ts` as `Awaited<ReturnType<typeof getAttendanceList>>["data"][number]` or similar, already used by this file's existing `import type { AttendanceListItem } from "@/lib/queries/attendance";`) automatically carries the two new fields since `getAttendanceList` uses `include`.

- [ ] **Step 5: Commit**

```bash
git add "app/(private)/hrd/manajemen-kehadiran/_components/AttendanceTable.tsx"
git commit -m "feat(hr): show attendantType/isPublicHoliday columns in attendance rekap table"
```

---

### Task 11: Informational badge on `AttendanceClock.tsx`

**Files:**
- Modify: `app/(private)/(general)/absensi/_components/AttendanceClock.tsx`
- Modify: `services/attendance-service.ts` (extend `AttendanceTodayResponse`/`fetchAttendanceToday` return type usage — type-only change, driven by the route change in Task 8)

**Interfaces:**
- Consumes: `context.attendantType`/`context.isPublicHoliday` from the `today` route response (Task 8); `attendance.attendantType`/`attendance.isPublicHoliday` from the same response's `attendance` object when already clocked in today (frozen values, Task 7).
- Produces: a purely informational badge; does not add, remove, or alter any `disabled` prop on the clock-in button.

- [ ] **Step 1: Confirm/extend the today-response type**

Read `lib/queries/attendance.ts`'s `AttendanceTodayResponse`-adjacent type export (search for where the `today` route's JSON shape is typed — likely inline in `services/attendance-service.ts`'s `AttendanceTodayResponse` import, or a local interface in `AttendanceClock.tsx`). Add a `context: { attendantType: "WORKDAY" | "DAY_OFF"; isPublicHoliday: boolean } | null` field to whichever type currently models the `today` route's response shape, matching exactly what Task 8's route now returns. Since the exact declaration site of `AttendanceTodayResponse` was not read in this research pass, locate it with:

```bash
grep -rn "AttendanceTodayResponse" lib/ services/ app/
```

and add the `context` field there, following the same optional/nullable convention already used for `shift`/`shiftSource` in that type (they are typed as `... | null` per the route's `?? null` fallback).

- [ ] **Step 2: Render the informational badge**

In `AttendanceClock.tsx`, wherever the existing shift/status info is displayed (near where `shift`/`shiftSource` from `useAttendanceToday()`'s data are already rendered), add a non-blocking badge block such as:

```tsx
{data?.attendance ? (
  <div className="flex items-center gap-2 flex-wrap">
    {data.attendance.attendantType === "DAY_OFF" && (
      <Badge variant="secondary">Libur Mingguan</Badge>
    )}
    {data.attendance.isPublicHoliday && (
      <Badge variant="destructive">Tanggal Merah</Badge>
    )}
  </div>
) : (
  data?.context && (
    <div className="flex items-center gap-2 flex-wrap">
      {data.context.attendantType === "DAY_OFF" && (
        <Badge variant="secondary">Libur Mingguan</Badge>
      )}
      {data.context.isPublicHoliday && (
        <Badge variant="destructive">Tanggal Merah</Badge>
      )}
    </div>
  )
)}
```

Adjust the exact JSX insertion point and `data`/hook variable name to match `AttendanceClock.tsx`'s actual local variable names from `useAttendanceToday()` (read the file immediately before this edit to confirm — do not guess the destructured variable name). The critical constraint: this block is purely additive display markup; it must not wrap, gate, or add a `disabled` condition to the existing Clock In `<Button>`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test in the browser**

Start the dev server (`npm run dev`), log in as a profile with an `EmployeeWorkAssignment`, navigate to `/absensi`. Confirm:
- The Clock In button is enabled regardless of any badge shown (test with and without a seeded `PublicHoliday` row for today, and with/without today's weekday in `offdayDays`).
- After clocking in, the badge reflects the frozen `attendance.attendantType`/`isPublicHoliday` (not a live-recomputed value) — verify by temporarily changing the profile's `offdayDays` after clock-in and confirming the already-rendered badge does not change until a fresh clock-in.

- [ ] **Step 5: Commit**

```bash
git add "app/(private)/(general)/absensi/_components/AttendanceClock.tsx" services/attendance-service.ts
git commit -m "feat(hr): show informational Public Holiday / Day Off badge on clock-in screen"
```

---

## Self-Review Notes

- **Spec coverage:** Goal 1 (PublicHoliday table + Settings page) → Tasks 1, 3, 4, 5. Goal 2 (frozen `attendantType`/`isPublicHoliday` on `Attendance`) → Tasks 1, 6, 7. Goal 3 (surfaced in rekap/export/badge) → Tasks 9, 10, 11. Goal 4 (never gate attendance) → enforced as a Global Constraint and called out explicitly in Tasks 7, 8, 11. Non-goals (no overtime logic, no cuti-bersama distinction, no per-date override via `ShiftOverride`, no leave integration) are respected — no task touches `ShiftOverride`, leave/cuti tables, or adds compensation logic. Testing section → Task 6 (unit tests for all 4 combinations) and Task 7/11 (manual smoke test, explicitly cross-referenced).
- **Placeholder scan:** All steps contain literal file paths, full code blocks, and exact before/after diffs — no "TBD"/"similar to Task N"/prose-only steps. The two exceptions where exact pre-existing code could not be quoted verbatim (Task 5 Step 5's icon-name fallback, Task 11 Steps 1-2's not-yet-located type declaration and hook variable name) are flagged inline with a concrete fallback action and a concrete lookup command, not left open-ended.
- **Type consistency:** `resolveAttendanceContext`'s return type `{ attendantType: "WORKDAY" | "DAY_OFF"; isPublicHoliday: boolean }` (Task 6) is used identically in Task 7 (`context.attendantType`, `context.isPublicHoliday`) and Task 8 (`context` spread into the route response). The Prisma-generated `AttendantType` enum values (`WORKDAY`/`DAY_OFF`, Task 1) match the string literals used everywhere else. `ATTENDANT_TYPE_LABEL`/`ATTENDANT_TYPE_BADGE` keys (Tasks 9, 10) match the enum values exactly.
