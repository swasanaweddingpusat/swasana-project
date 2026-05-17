# Groups Feature Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the existing "My Team" feature and the "Groups tab in Settings" into a single top-level "Groups" feature with super-admin leader assignment, summary cards, bar charts, and a table with per-group performance stats.

**Architecture:** The `my-team` route, actions, queries, and API routes are renamed/merged into `groups`. Permissions `my-team:*` and `settings-groups:*` are consolidated into `groups:*` via a data migration. No Prisma schema changes — only routing, permissions, and UI change.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript strict, Prisma 7 (Neon HTTP — array transaction only), shadcn v4 + Tailwind v4, TanStack Query v5, Recharts via `shadcn add chart`.

---

## File Map

| Action | Path |
|---|---|
| **Create** | `prisma/migrations/20260517_rename_permissions_to_groups/migration.sql` |
| **Rewrite** | `actions/groups.ts` (merge `actions/group.ts` + `actions/my-team.ts`) |
| **Delete** | `actions/group.ts`, `actions/my-team.ts` |
| **Rewrite** | `lib/queries/groups.ts` (merge `lib/queries/groups.ts` + `lib/queries/my-team.ts`) |
| **Delete** | `lib/queries/my-team.ts` |
| **Rewrite** | `app/api/groups/route.ts` |
| **Create** | `app/api/groups/performance/route.ts` |
| **Create** | `app/api/groups/[groupId]/performance/route.ts` |
| **Delete** | `app/api/my-team/` (folder) |
| **Rewrite** | `services/group-service.ts` |
| **Rewrite** | `hooks/use-groups.ts` |
| **Create** | `hooks/useGroupsPerformance.ts` |
| **Add schema** | `lib/validations/user.ts` (add `updateGroupLeaderSchema`) |
| **Create** | `app/(private)/dashboard/groups/page.tsx` |
| **Create** | `app/(private)/dashboard/groups/_components/GroupsClient.tsx` |
| **Create** | `app/(private)/dashboard/groups/_components/GroupsStatsCards.tsx` |
| **Create** | `app/(private)/dashboard/groups/_components/GroupsRevenueChart.tsx` |
| **Create** | `app/(private)/dashboard/groups/_components/GroupsTable.tsx` |
| **Create** | `app/(private)/dashboard/groups/_components/GroupFormDialog.tsx` |
| **Create** | `app/(private)/dashboard/groups/[groupId]/page.tsx` |
| **Create** | `app/(private)/dashboard/groups/[groupId]/_components/GroupDetailClient.tsx` |
| **Create** | `app/(private)/dashboard/groups/[groupId]/_components/GroupMemberChart.tsx` |
| **Create** | `app/(private)/dashboard/groups/[groupId]/_components/ChangeLeaderDialog.tsx` |
| **Copy** | `app/(private)/dashboard/groups/[groupId]/_components/SalesDetailModal.tsx` (from my-team) |
| **Delete** | `app/(private)/dashboard/my-team/` (folder) |
| **Modify** | `lib/route-meta.ts` |
| **Modify** | `app/(private)/dashboard/_components/sidebar/sidebar-config.ts` |
| **Modify** | `app/(private)/dashboard/_components/sidebar/sidebar-nav.tsx` |
| **Modify** | `next.config.ts` (add redirects) |
| **Modify** | `app/(private)/dashboard/settings/user-management/_components/users-and-groups.tsx` |
| **Modify** | `AGENTS.md` (update permissions table) |

---

## Task 1: DB Migration — rename permissions

**Files:**
- Create: `prisma/migrations/20260517_rename_permissions_to_groups/migration.sql`

- [ ] **Step 1: Create migration directory + SQL file**

```bash
mkdir -p prisma/migrations/20260517_rename_permissions_to_groups
```

Write `prisma/migrations/20260517_rename_permissions_to_groups/migration.sql`:

```sql
-- Add new groups:* permissions
INSERT INTO "permissions" (id, module, action) VALUES
  (gen_random_uuid()::text, 'groups', 'view'),
  (gen_random_uuid()::text, 'groups', 'view-all'),
  (gen_random_uuid()::text, 'groups', 'create'),
  (gen_random_uuid()::text, 'groups', 'edit'),
  (gen_random_uuid()::text, 'groups', 'delete')
ON CONFLICT (module, action) DO NOTHING;

-- Migrate role_permissions: my-team:* → groups:*
INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, rp."roleId", new_p.id
FROM "role_permissions" rp
JOIN "permissions" old_p ON rp."permissionId" = old_p.id AND old_p.module = 'my-team'
JOIN "permissions" new_p ON new_p.module = 'groups' AND new_p.action = old_p.action
ON CONFLICT DO NOTHING;

-- Migrate role_permissions: settings-groups:* → groups:* (view, create, edit, delete)
INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, rp."roleId", new_p.id
FROM "role_permissions" rp
JOIN "permissions" old_p ON rp."permissionId" = old_p.id AND old_p.module = 'settings-groups'
JOIN "permissions" new_p ON new_p.module = 'groups' AND new_p.action = old_p.action
ON CONFLICT DO NOTHING;

-- Remove old role_permissions rows first
DELETE FROM "role_permissions"
WHERE "permissionId" IN (
  SELECT id FROM "permissions" WHERE module IN ('my-team', 'settings-groups')
);

-- Remove old permissions
DELETE FROM "permissions" WHERE module IN ('my-team', 'settings-groups');
```

- [ ] **Step 2: Apply migration**

```bash
npx prisma migrate deploy
```

Expected: `1 migration applied` (or `already applied` if re-running).

- [ ] **Step 3: Validate**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260517_rename_permissions_to_groups/
git commit -m "feat(groups): add migration to rename permissions my-team+settings-groups → groups"
```

---

## Task 2: Rewrite `actions/groups.ts`

This merges `actions/group.ts` + `actions/my-team.ts` into one file. Fixes:
- Permission modules: `settings-groups` → `groups`, `my-team` → `groups`
- `addGroupMember` callback transaction → sequential queries (sortOrder is cosmetic)
- `setMemberTarget` callback transaction → array form
- `createGroup` callback transaction → sequential queries
- Add `updateGroupLeader` (super admin only)

**Files:**
- Create: `actions/groups.ts`

- [ ] **Step 1: Write `actions/groups.ts`**

```ts
"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import {
  createGroupSchema,
  updateGroupSchema,
  setMemberTargetSchema,
  updateGroupLeaderSchema,
} from "@/lib/validations/user";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const lastGroup = await db.userGroup.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const group = await db.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        leaderId: parsed.data.leaderId ?? null,
        createdBy: session!.user.id,
        sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
      },
    });

    revalidateTag("groups", { expire: 0 });
    revalidateTag("users", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.created",
      entityType: "group",
      entityId: group.id,
      description: `Grup "${group.name}" dibuat`,
      changes: { after: { name: group.name } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, group };
  } catch (e) {
    console.error("[createGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Group ─────────────────────────────────────────────────────────────

export async function updateGroup(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, name, description, leaderId } = parsed.data;

  try {
    const [group] = await db.$transaction([
      db.userGroup.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(leaderId !== undefined && { leaderId: leaderId ?? null }),
        },
      }),
    ]);

    revalidateTag("groups", { expire: 0 });
    revalidateTag("users", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.updated",
      entityType: "group",
      entityId: id,
      description: `Grup "${group.name}" diperbarui`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, group };
  } catch (e) {
    console.error("[updateGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Group ─────────────────────────────────────────────────────────────

export async function deleteGroup(groupId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const group = await db.userGroup.findUnique({ where: { id: groupId }, select: { name: true } });
    if (!group) return { success: false, error: "Grup tidak ditemukan." };

    await db.$transaction([db.userGroup.delete({ where: { id: groupId } })]);

    revalidateTag("groups", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.deleted",
      entityType: "group",
      entityId: groupId,
      description: `Grup "${group.name}" dihapus`,
      changes: { before: { name: group.name } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true };
  } catch (e) {
    console.error("[deleteGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: string, profileId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-member-add:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    // Sequential queries — sortOrder is cosmetic, not transactional
    const last = await db.userGroupMember.findFirst({
      where: { groupId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await db.userGroupMember.create({
      data: { groupId, userId: profileId, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });

    revalidateTag("groups", { expire: 0 });
    revalidateTag("users", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[addGroupMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

export async function removeGroupMember(groupId: string, profileId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-member-rm:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.userGroupMember.delete({ where: { groupId_userId: { groupId, userId: profileId } } }),
    ]);

    revalidateTag("groups", { expire: 0 });
    revalidateTag("users", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[removeGroupMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Set Member Target ────────────────────────────────────────────────────────

export async function setMemberTarget(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-target:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = setMemberTargetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { profileId, amount, startDate, endDate } = parsed.data;
  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    // Array form: deleteMany overlapping targets + create new one
    await db.$transaction([
      db.userTarget.deleteMany({
        where: {
          profileId,
          type: "sales",
          startDate: { lte: end },
          endDate: { gte: start },
        },
      }),
      db.userTarget.create({
        data: {
          profileId,
          type: "sales",
          amount: BigInt(amount),
          startDate: start,
          endDate: end,
          setById: session!.user.profileId,
        },
      }),
    ]);

    revalidateTag("groups", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[setMemberTarget]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Group Leader (Super Admin Only) ───────────────────────────────────

export async function updateGroupLeader(groupId: string, leaderId: string) {
  const parsed = updateGroupLeaderSchema.safeParse({ groupId, leaderId });
  if (!parsed.success) return { success: false, error: "Data tidak valid" };

  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!session.user.isSuperAdmin) return { success: false, error: "Hanya super admin yang bisa mengganti leader." };
  if (!mutationLimiter.check(`groups-leader:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.userGroup.update({ where: { id: groupId }, data: { leaderId } }),
    ]);

    revalidateTag("groups", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "group.leader_changed",
      entityType: "group",
      entityId: groupId,
      changes: { after: { leaderId } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true };
  } catch (e) {
    console.error("[updateGroupLeader]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Approve Booking ──────────────────────────────────────────────────────────

export async function approveBooking(bookingId: string) {
  const permResult = await requirePermission({ module: "booking", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`booking-approve:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const scope = await getProfileDataScope(session.user.profileId);
  if (!(await canAccessBooking(session.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const [booking] = await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: { managerId: session.user.profileId },
      }),
    ]);

    revalidateTag("groups", { expire: 0 });
    revalidateTag("bookings", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "booking.approved",
      entityType: "booking",
      entityId: bookingId,
      description: `Booking disetujui oleh manager`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, booking };
  } catch (e) {
    console.error("[approveBooking]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
```

- [ ] **Step 2: Delete old action files**

```bash
git rm actions/group.ts actions/my-team.ts
```

- [ ] **Step 3: Commit**

```bash
git add actions/groups.ts
git commit -m "feat(groups): merge actions/group.ts + actions/my-team.ts → actions/groups.ts, fix callback transactions"
```

---

## Task 3: Add `updateGroupLeaderSchema` to validations

**Files:**
- Modify: `lib/validations/user.ts`

- [ ] **Step 1: Add schema at the bottom of the Groups section in `lib/validations/user.ts`**

After line 77 (end of `setMemberTargetSchema`), before the `// ─── Inferred types` comment, add:

```ts
export const updateGroupLeaderSchema = z.object({
  groupId: z.string().min(1),
  leaderId: z.string().min(1),
});
```

Also add the inferred type at the bottom:

```ts
export type UpdateGroupLeaderInput = z.infer<typeof updateGroupLeaderSchema>;
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `updateGroupLeaderSchema`.

- [ ] **Step 3: Commit**

```bash
git add lib/validations/user.ts
git commit -m "feat(groups): add updateGroupLeaderSchema validation"
```

---

## Task 4: Rewrite `lib/queries/groups.ts`

Merges `lib/queries/groups.ts` + `lib/queries/my-team.ts`. Adds:
- `getGroupPerformance(groupId, startDate, endDate)` — proper date filtering at DB level
- `getGroupsWithPerformance(profileId?, startDate, endDate)` — for index page aggregate
- Fix: `getAvailableSalesProfiles` removes `role.name === "sales"` string match

**Files:**
- Rewrite: `lib/queries/groups.ts`
- Delete: `lib/queries/my-team.ts`

- [ ] **Step 1: Rewrite `lib/queries/groups.ts`**

```ts
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

// ─── Paginated list (used by settings & API) ──────────────────────────────────

export async function getGroups(page = 1, limit = 10) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    db.userGroup.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        leaderId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        leader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        members: {
          select: {
            userId: true,
            sortOrder: true,
            profile: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
                role: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { members: true } },
      },
      orderBy: { sortOrder: "asc" },
      skip,
      take: limit,
    }),
    db.userGroup.count(),
  ]);

  return { data, total, page, limit };
}

export async function getGroupById(groupId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      leader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      members: {
        select: {
          userId: true,
          sortOrder: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              role: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { members: true } },
    },
  });
}

// ─── Lightweight list (used by sidebar + index page) ─────────────────────────

export async function getAllGroups() {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      leader: { select: { fullName: true, avatarUrl: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getUserGroups(profileId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findMany({
    where: {
      OR: [
        { leaderId: profileId },
        { members: { some: { userId: profileId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      leader: { select: { fullName: true, avatarUrl: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getGroupDetail(groupId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      members: {
        select: {
          userId: true,
          profile: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ─── Performance queries ──────────────────────────────────────────────────────

/** Per-member performance for a single group, filtered by date range at DB level */
export async function getGroupPerformance(groupId: string, startDate: Date, endDate: Date) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  const group = await db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      members: {
        select: { userId: true, profile: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!group) return [];

  const results = await Promise.all(
    group.members.map(async ({ userId: profileId, profile }) => {
      const [bookingRevenues, target] = await Promise.all([
        db.booking.findMany({
          where: {
            salesId: profileId,
            bookingStatus: { not: BookingStatus.Canceled },
            bookingDate: { gte: startDate, lte: endDate },
          },
          select: {
            bookingStatus: true,
            managerApprovedAt: true,
            snapPackageVariant: { select: { price: true } },
          },
          take: 1000,
        }),
        db.userTarget.findFirst({
          where: {
            profileId,
            type: "sales",
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { amount: true },
        }),
      ]);

      const confirmed = bookingRevenues.filter((b) => b.bookingStatus === BookingStatus.Confirmed);
      const pendingApproval = bookingRevenues.filter((b) => b.managerApprovedAt === null);
      const actual = confirmed.reduce((sum, b) => sum + (b.snapPackageVariant?.price ?? 0), 0);
      const targetAmount = target ? Number(target.amount) : 0;
      const achievement = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

      return {
        profileId,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        actual,
        target: targetAmount,
        achievement,
        bookings: bookingRevenues.length,
        confirmed: confirmed.length,
        pendingApproval: pendingApproval.length,
      };
    }),
  );

  return results.sort((a, b) => b.actual - a.actual);
}

/** Aggregate performance across all visible groups — for index page */
export async function getGroupsWithPerformance(
  profileId: string | undefined,
  startDate: Date,
  endDate: Date,
) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  const groups = profileId ? await getUserGroups(profileId) : await getAllGroups();

  return Promise.all(
    groups.map(async (g) => {
      const perf = await getGroupPerformance(g.id, startDate, endDate);
      const revenue = perf.reduce((s, m) => s + m.actual, 0);
      const avgAchievement =
        perf.length > 0
          ? Math.round(perf.reduce((s, m) => s + m.achievement, 0) / perf.length)
          : 0;
      const confirmedCount = perf.reduce((s, m) => s + m.confirmed, 0);
      return { ...g, revenue, avgAchievement, confirmedCount };
    }),
  );
}

// ─── Member management helpers ────────────────────────────────────────────────

/** Bookings for a single sales member — used in detail drawer */
export async function getSalesBookings(salesId: string) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  return db.booking.findMany({
    where: { salesId },
    select: {
      id: true,
      bookingStatus: true,
      poNumber: true,
      weddingSession: true,
      bookingDate: true,
      snapCustomer: { select: { name: true, mobileNumber: true } },
      snapVenue: { select: { venueName: true } },
      snapPackage: { select: { packageName: true } },
      snapPackageVariant: { select: { price: true } },
      paymentMethod: { select: { bankName: true } },
    },
    orderBy: { bookingDate: "desc" },
  });
}

/** Profiles that can be added as members — active profiles not already excluded */
export async function getAvailableSalesProfiles(excludeIds: string[]) {
  "use cache";
  cacheTag("groups", "users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: {
      id: { notIn: excludeIds },
      status: "active",
    },
    select: { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
    take: 200,
  });
}

// ─── Return types ─────────────────────────────────────────────────────────────

export type GroupsQueryResult = Awaited<ReturnType<typeof getGroups>>;
export type GroupQueryItem = GroupsQueryResult["data"][number];
export type GroupCard = Awaited<ReturnType<typeof getAllGroups>>[number];
export type GroupDetail = Awaited<ReturnType<typeof getGroupDetail>>;
export type GroupPerformanceItem = Awaited<ReturnType<typeof getGroupPerformance>>[number];
export type GroupWithPerformance = Awaited<ReturnType<typeof getGroupsWithPerformance>>[number];
export type SalesBookingItem = Awaited<ReturnType<typeof getSalesBookings>>[number];
export type AvailableSalesProfile = Awaited<ReturnType<typeof getAvailableSalesProfiles>>[number];
```

- [ ] **Step 2: Delete old queries file**

```bash
git rm lib/queries/my-team.ts
```

- [ ] **Step 3: Check TypeScript errors from removed file**

```bash
npx tsc --noEmit 2>&1 | grep "my-team" | head -20
```

Errors will point to files still importing from `lib/queries/my-team` — these are fixed in later tasks (pages, client component). Note them, don't fix yet.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/groups.ts
git commit -m "feat(groups): merge queries, fix date filtering + role string-match bug, add getGroupsWithPerformance"
```

---

## Task 5: Update API Routes

**Files:**
- Rewrite: `app/api/groups/route.ts`
- Create: `app/api/groups/performance/route.ts`
- Create: `app/api/groups/[groupId]/performance/route.ts`
- Delete: `app/api/my-team/` (folder)

- [ ] **Step 1: Rewrite `app/api/groups/route.ts`**

```ts
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroups } from "@/lib/queries/groups";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`groups-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const groups = await getGroups();
    return Response.json(groups);
  } catch {
    return Response.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/groups/performance/route.ts`**

This returns aggregate stats + per-group performance for the index page.

```ts
import { requirePermissionForRoute, hasPermission } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupsWithPerformance } from "@/lib/queries/groups";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`groups-perf:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get("startDate");
  const endStr = searchParams.get("endDate");

  if (!startStr || !endStr) {
    return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  const isViewAll =
    session.user.isSuperAdmin ||
    (await hasPermission(session.user.roleId, "groups", "view-all"));

  const groups = await getGroupsWithPerformance(
    isViewAll ? undefined : session.user.profileId,
    startDate,
    endDate,
  );

  const totalSales = groups.reduce((s, g) => s + g.revenue, 0);
  const avgAchievement =
    groups.length > 0
      ? Math.round(groups.reduce((s, g) => s + g.avgAchievement, 0) / groups.length)
      : 0;
  const totalConfirmed = groups.reduce((s, g) => s + g.confirmedCount, 0);

  return Response.json({
    summary: { totalGroups: groups.length, totalSales, avgAchievement, totalConfirmed },
    groups,
  });
}
```

- [ ] **Step 3: Create `app/api/groups/[groupId]/performance/route.ts`**

```ts
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGroupPerformance } from "@/lib/queries/groups";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { session, response } = await requirePermissionForRoute({ module: "groups", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`groups-detail-perf:${session.user.id}`)) return rateLimitResponse();

  const { groupId } = await params;
  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get("startDate");
  const endStr = searchParams.get("endDate");

  if (!startStr || !endStr) {
    return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
  }

  const performance = await getGroupPerformance(groupId, new Date(startStr), new Date(endStr));
  return Response.json(performance);
}
```

- [ ] **Step 4: Delete old my-team API folder**

```bash
git rm -r app/api/my-team/
```

- [ ] **Step 5: Commit**

```bash
git add app/api/groups/
git commit -m "feat(groups): update API routes — fix permission module, add performance endpoints"
```

---

## Task 6: Update Services + Hooks

**Files:**
- Rewrite: `services/group-service.ts`
- Rewrite: `hooks/use-groups.ts`
- Create: `hooks/useGroupsPerformance.ts`

- [ ] **Step 1: Rewrite `services/group-service.ts`**

```ts
import type { GroupsQueryResult, GroupQueryItem, GroupWithPerformance } from "@/lib/queries/groups";

export interface GroupsPerformanceSummary {
  totalGroups: number;
  totalSales: number;
  avgAchievement: number;
  totalConfirmed: number;
}

export interface GroupsPerformanceResponse {
  summary: GroupsPerformanceSummary;
  groups: GroupWithPerformance[];
}

export async function fetchGroups(): Promise<GroupsQueryResult> {
  const res = await fetch("/api/groups");
  if (!res.ok) throw new Error("Failed to fetch groups");
  return res.json();
}

export async function fetchGroupById(id: string): Promise<GroupQueryItem> {
  const res = await fetch(`/api/groups/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch group ${id}`);
  return res.json();
}

export async function fetchGroupsPerformance(
  startDate: string,
  endDate: string,
): Promise<GroupsPerformanceResponse> {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/groups/performance?${params}`);
  if (!res.ok) throw new Error("Failed to fetch groups performance");
  return res.json();
}
```

- [ ] **Step 2: Rewrite `hooks/use-groups.ts`**

Update all imports from `@/actions/group` → `@/actions/groups`. Remove reorder hooks (out of scope).

```ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GroupsQueryResult } from "@/lib/queries/groups";
import { fetchGroups } from "@/services/group-service";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
} from "@/actions/groups";
import type { CreateGroupInput, UpdateGroupInput } from "@/lib/validations/user";

export function useGroups(initialData?: GroupsQueryResult) {
  return useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) => createGroup(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateGroupInput) => updateGroup(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      addGroupMember(groupId, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeGroupMember(groupId, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); },
  });
}
```

- [ ] **Step 3: Create `hooks/useGroupsPerformance.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupsPerformance } from "@/services/group-service";

export function useGroupsPerformance(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["groups", "performance", startDate, endDate],
    queryFn: () => fetchGroupsPerformance(startDate, endDate),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add services/group-service.ts hooks/use-groups.ts hooks/useGroupsPerformance.ts
git commit -m "feat(groups): update service, hooks — remove reorder, add performance hooks"
```

---

## Task 7: Install shadcn chart

The index and detail pages use `BarChart` from shadcn's chart component (Recharts wrapper).

**Files:**
- Generated: `components/ui/chart.tsx` (do NOT hand-edit after generation)

- [ ] **Step 1: Add chart component**

```bash
npx shadcn add chart
```

Expected: `✔ Done! chart was added to your project.`

- [ ] **Step 2: Verify file exists**

```bash
ls components/ui/chart.tsx
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/chart.tsx
git commit -m "feat(groups): add shadcn chart component (Recharts wrapper)"
```

---

## Task 8: Create Groups Index Page

**Files:**
- Create: `app/(private)/dashboard/groups/page.tsx`
- Create: `app/(private)/dashboard/groups/_components/GroupsClient.tsx`
- Create: `app/(private)/dashboard/groups/_components/GroupsStatsCards.tsx`
- Create: `app/(private)/dashboard/groups/_components/GroupsRevenueChart.tsx`
- Create: `app/(private)/dashboard/groups/_components/GroupsTable.tsx`
- Create: `app/(private)/dashboard/groups/_components/GroupFormDialog.tsx`

- [ ] **Step 1: Create `app/(private)/dashboard/groups/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getGroupsWithPerformance } from "@/lib/queries/groups";
import { GroupsClient } from "./_components/GroupsClient";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;
  const isViewAll =
    session.user.isSuperAdmin ||
    (await hasPermission(session.user.roleId, "groups", "view-all"));

  const hasView = await hasPermission(session.user.roleId, "groups", "view");
  if (!hasView && !isViewAll) redirect("/dashboard?error=forbidden");

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const groups = await getGroupsWithPerformance(
    isViewAll ? undefined : profileId,
    startDate,
    endDate,
  );

  const canCreate = session.user.isSuperAdmin || (await hasPermission(session.user.roleId, "groups", "create"));
  const canEdit = session.user.isSuperAdmin || (await hasPermission(session.user.roleId, "groups", "edit"));
  const canDelete = session.user.isSuperAdmin || (await hasPermission(session.user.roleId, "groups", "delete"));

  return (
    <div className="px-2 pb-6">
      <GroupsClient
        initialGroups={groups}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(private)/dashboard/groups/_components/GroupsStatsCards.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, Target, CalendarCheck } from "lucide-react";

interface Props {
  totalGroups: number;
  totalSales: number;
  avgAchievement: number;
  totalConfirmed: number;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function GroupsStatsCards({ totalGroups, totalSales, avgAchievement, totalConfirmed }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { icon: Users, label: "Total Groups", value: totalGroups.toString() },
        { icon: DollarSign, label: "Total Sales", value: formatRp(totalSales) },
        { icon: Target, label: "Avg Achievement", value: `${avgAchievement}%` },
        { icon: CalendarCheck, label: "Booking Confirmed", value: totalConfirmed.toString() },
      ].map(({ icon: Icon, label, value }) => (
        <Card key={label} className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(private)/dashboard/groups/_components/GroupsRevenueChart.tsx`**

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { GroupWithPerformance } from "@/lib/queries/groups";

const chartConfig = {
  revenue: { label: "Revenue" },
} satisfies ChartConfig;

interface Props {
  groups: GroupWithPerformance[];
}

export function GroupsRevenueChart({ groups }: Props) {
  const data = groups.map((g) => ({
    name: g.name.length > 10 ? `${g.name.slice(0, 10)}…` : g.name,
    revenue: g.revenue,
  }));

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Perbandingan Revenue per Group</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : v.toString()
              }
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    `Rp ${Number(value).toLocaleString("id-ID")}`
                  }
                />
              }
            />
            <Bar dataKey="revenue" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `app/(private)/dashboard/groups/_components/GroupsTable.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ArrowRight, Edit } from "lucide-react";
import type { GroupWithPerformance } from "@/lib/queries/groups";

interface Props {
  groups: GroupWithPerformance[];
  canEdit: boolean;
  onEdit: (group: GroupWithPerformance) => void;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function GroupsTable({ groups, canEdit, onEdit }: Props) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">Belum ada group</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.5fr_0.7fr_1.2fr_1.2fr_0.9fr_auto] px-4 py-2.5 bg-secondary text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
        <span>Nama Group</span>
        <span>Leader</span>
        <span className="text-center">Anggota</span>
        <span>Total Sales</span>
        <span>Achievement</span>
        <span className="text-center">Confirmed</span>
        <span className="w-20" />
      </div>

      {groups.map((group) => (
        <div
          key={group.id}
          className="grid grid-cols-[2fr_1.5fr_0.7fr_1.2fr_1.2fr_0.9fr_auto] px-4 py-3 border-b border-border last:border-b-0 items-center hover:bg-secondary/30 transition-colors"
        >
          <div>
            <Link
              href={`/dashboard/groups/${group.id}`}
              className="text-sm font-semibold hover:underline"
            >
              {group.name}
            </Link>
            {group.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                {group.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {group.leader ? (
              <>
                <ProfileAvatar
                  name={group.leader.fullName ?? ""}
                  src={group.leader.avatarUrl ?? undefined}
                  size="sm"
                />
                <span className="text-sm truncate">{group.leader.fullName}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="text-center text-sm">{group._count.members}</div>

          <div className="text-sm font-semibold">{formatRp(group.revenue)}</div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all"
                style={{ width: `${Math.min(group.avgAchievement, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold w-9 text-right">{group.avgAchievement}%</span>
          </div>

          <div className="text-center text-sm">{group.confirmedCount}</div>

          <div className="flex items-center gap-1 w-20 justify-end">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(group)}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/dashboard/groups/${group.id}`}>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(private)/dashboard/groups/_components/GroupFormDialog.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createGroup, updateGroup } from "@/actions/groups";
import type { GroupWithPerformance } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: GroupWithPerformance | null;
}

export function GroupFormDialog({ open, onOpenChange, group }: Props) {
  const isEdit = !!group;
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");

  function handleSubmit() {
    startTransition(async () => {
      const res = isEdit
        ? await updateGroup({ id: group.id, name, description })
        : await createGroup({ name, description });

      if (res.success) {
        toast.success(isEdit ? "Grup berhasil diperbarui" : "Grup berhasil dibuat");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{isEdit ? "Edit Group" : "Buat Group Baru"}</DialogTitle>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-sm">Nama Group</Label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama group"
            />
          </div>
          <div>
            <Label className="text-sm">Deskripsi</Label>
            <Textarea
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi (opsional)"
              rows={3}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || !name.trim()}
            onClick={handleSubmit}
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Create `app/(private)/dashboard/groups/_components/GroupsClient.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { GroupsStatsCards } from "./GroupsStatsCards";
import { GroupsRevenueChart } from "./GroupsRevenueChart";
import { GroupsTable } from "./GroupsTable";
import { GroupFormDialog } from "./GroupFormDialog";
import { useGroupsPerformance } from "@/hooks/useGroupsPerformance";
import type { GroupWithPerformance } from "@/lib/queries/groups";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

interface Props {
  initialGroups: GroupWithPerformance[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function GroupsClient({ initialGroups, canCreate, canEdit, canDelete: _canDelete }: Props) {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithPerformance | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const s = new Date(filterYear, filterMonth, 1);
    const e = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }, [filterMonth, filterYear]);

  const { data } = useGroupsPerformance(startDate, endDate);
  const groups = data?.groups ?? initialGroups;
  const summary = data?.summary ?? {
    totalGroups: initialGroups.length,
    totalSales: initialGroups.reduce((s, g) => s + g.revenue, 0),
    avgAchievement: initialGroups.length > 0
      ? Math.round(initialGroups.reduce((s, g) => s + g.avgAchievement, 0) / initialGroups.length)
      : 0,
    totalConfirmed: initialGroups.reduce((s, g) => s + g.confirmedCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Groups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola tim dan pantau kinerja penjualan</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Group
            </Button>
          )}
        </div>
      </div>

      <GroupsStatsCards {...summary} />
      <GroupsRevenueChart groups={groups} />

      <div>
        <h2 className="text-sm font-semibold mb-3">Daftar Groups</h2>
        <GroupsTable
          groups={groups}
          canEdit={canEdit}
          onEdit={setEditGroup}
        />
      </div>

      <GroupFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <GroupFormDialog open={!!editGroup} onOpenChange={(o) => { if (!o) setEditGroup(null); }} group={editGroup} />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add app/(private)/dashboard/groups/
git commit -m "feat(groups): create groups index page with stats cards, bar chart, and groups table"
```

---

## Task 9: Create Groups Detail Page

**Files:**
- Create: `app/(private)/dashboard/groups/[groupId]/page.tsx`
- Create: `app/(private)/dashboard/groups/[groupId]/_components/GroupDetailClient.tsx`
- Create: `app/(private)/dashboard/groups/[groupId]/_components/GroupMemberChart.tsx`
- Create: `app/(private)/dashboard/groups/[groupId]/_components/ChangeLeaderDialog.tsx`
- Copy+modify: `app/(private)/dashboard/groups/[groupId]/_components/SalesDetailModal.tsx`

- [ ] **Step 1: Copy `SalesDetailModal` from old my-team location**

```bash
cp "app/(private)/dashboard/my-team/[groupId]/_components/sales-detail-drawer.tsx" \
   "app/(private)/dashboard/groups/[groupId]/_components/SalesDetailModal.tsx"
```

Then open the copied file and update the import of `approveBooking`:

Old: `import { approveBooking } from "@/actions/my-team";`
New: `import { approveBooking } from "@/actions/groups";`

- [ ] **Step 2: Create `app/(private)/dashboard/groups/[groupId]/_components/GroupMemberChart.tsx`**

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { GroupPerformanceItem } from "@/lib/queries/groups";

const chartConfig = {
  actual: { label: "Revenue" },
} satisfies ChartConfig;

interface Props {
  members: GroupPerformanceItem[];
}

export function GroupMemberChart({ members }: Props) {
  const data = members.map((m) => ({
    name: (m.fullName ?? m.profileId).split(" ")[0],
    actual: m.actual,
  }));

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Revenue per Anggota</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : v.toString()
              }
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    `Rp ${Number(value).toLocaleString("id-ID")}`
                  }
                />
              }
            />
            <Bar dataKey="actual" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `app/(private)/dashboard/groups/[groupId]/_components/ChangeLeaderDialog.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateGroupLeader } from "@/actions/groups";
import type { GroupDetail } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: NonNullable<GroupDetail>;
}

export function ChangeLeaderDialog({ open, onOpenChange, group }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(group.leaderId ?? "");

  function handleSave() {
    if (!selectedId) return;
    startTransition(async () => {
      const res = await updateGroupLeader(group.id, selectedId);
      if (res.success) {
        toast.success("Leader berhasil diganti");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Ganti Leader — {group.name}</DialogTitle>
        <div className="mt-2 space-y-3">
          <div>
            <Label className="text-sm">Pilih Leader Baru</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih anggota..." />
              </SelectTrigger>
              <SelectContent>
                {group.members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.profile.fullName ?? m.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || !selectedId}
            onClick={handleSave}
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create `app/(private)/dashboard/groups/[groupId]/_components/GroupDetailClient.tsx`**

This is based on `MyTeamClient` with these changes:
- Action imports from `@/actions/groups` (not `my-team`)
- Types from `@/lib/queries/groups` (not `my-team`)
- API call to `/api/groups/[groupId]/performance` (not `/api/my-team/performance`)
- Added: `GroupMemberChart` between overview cards and ranking table
- Added: `isSuperAdmin` prop + `ChangeLeaderDialog`
- `canManage` is now `canEdit` (not just leader-check — admins can also manage)

```tsx
"use client";

import { useState, useTransition, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/shared/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Crown, TrendingUp, TrendingDown, Target, Users, DollarSign, CalendarCheck,
  Plus, Settings, MoreHorizontal, PenLine, Trash2, UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SalesDetailModal } from "./SalesDetailModal";
import { GroupMemberChart } from "./GroupMemberChart";
import { ChangeLeaderDialog } from "./ChangeLeaderDialog";
import {
  updateGroup,
  addGroupMember,
  removeGroupMember,
  setMemberTarget,
} from "@/actions/groups";
import type { GroupDetail, GroupPerformanceItem, AvailableSalesProfile } from "@/lib/queries/groups";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

interface Props {
  group: NonNullable<GroupDetail>;
  initialPerformance: GroupPerformanceItem[];
  availableProfiles: AvailableSalesProfile[];
  currentProfileId: string;
  canManage: boolean;
  isSuperAdmin: boolean;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`;
  return n.toLocaleString("id-ID");
}

function formatFull(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function achievementPct(actual: number, target: number) {
  if (target === 0) return 0;
  return Math.round((actual / target) * 100);
}

export function GroupDetailClient({
  group,
  initialPerformance,
  availableProfiles,
  currentProfileId: _currentProfileId,
  canManage,
  isSuperAdmin,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const periodLabel = `${MONTHS[filterMonth]} ${filterYear}`;

  const { startDate, endDate } = useMemo(() => {
    const s = new Date(filterYear, filterMonth, 1);
    const e = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }, [filterMonth, filterYear]);

  const { data: performance = initialPerformance } = useQuery<GroupPerformanceItem[]>({
    queryKey: ["groups-performance", group.id, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/groups/${group.id}/performance?${params}`);
      if (!res.ok) return initialPerformance;
      return res.json();
    },
    initialData: initialPerformance,
    staleTime: 60_000,
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [groupDesc, setGroupDesc] = useState(group.description ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [changeLeaderOpen, setChangeLeaderOpen] = useState(false);

  type MemberRow = { profileId: string; name: string; target: number };
  const [editTargetMember, setEditTargetMember] = useState<MemberRow | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [targetFrom, setTargetFrom] = useState("");
  const [targetTo, setTargetTo] = useState("");
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [deleteMember, setDeleteMember] = useState<MemberRow | null>(null);

  const memberRows = group.members.map((m) => {
    const perf = performance.find((p) => p.profileId === m.userId);
    return {
      profileId: m.userId,
      name: m.profile.fullName ?? m.userId,
      avatarUrl: m.profile.avatarUrl ?? undefined,
      target: perf?.target ?? 0,
      actual: perf?.actual ?? 0,
      bookings: perf?.bookings ?? 0,
      confirmed: perf?.confirmed ?? 0,
      pendingApproval: perf?.pendingApproval ?? 0,
    };
  });

  const sorted = [...memberRows].sort((a, b) => b.actual - a.actual);
  const totalSales = memberRows.reduce((s, m) => s + m.actual, 0);
  const totalTarget = memberRows.reduce((s, m) => s + m.target, 0);
  const totalBookings = memberRows.reduce((s, m) => s + m.bookings, 0);
  const totalConfirmed = memberRows.reduce((s, m) => s + m.confirmed, 0);
  const overallPct = achievementPct(totalSales, totalTarget);
  const leaderProfile = group.members.find((m) => m.userId === group.leaderId)?.profile;

  function handleSaveSettings() {
    startTransition(async () => {
      const res = await updateGroup({ id: group.id, name: groupName, description: groupDesc });
      if (res.success) {
        toast.success("Pengaturan grup disimpan");
        setSettingsOpen(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleAddMember(profileId: string) {
    startTransition(async () => {
      const res = await addGroupMember(group.id, profileId);
      if (res.success) {
        toast.success("Anggota berhasil ditambahkan");
        setAddOpen(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleRemoveMember() {
    if (!deleteMember) return;
    startTransition(async () => {
      const res = await removeGroupMember(group.id, deleteMember.profileId);
      if (res.success) {
        toast.success(`${deleteMember.name} dihapus dari grup`);
        setDeleteMember(null);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleSaveTarget() {
    if (!editTargetMember) return;
    startTransition(async () => {
      const res = await setMemberTarget({
        groupId: group.id,
        profileId: editTargetMember.profileId,
        amount: Number(targetInput) || 0,
        startDate: targetFrom,
        endDate: targetTo,
      });
      if (res.success) {
        toast.success("Target berhasil disimpan");
        setEditTargetMember(null);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Group Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-foreground">{groupName}</h1>
          {groupDesc && <p className="text-sm text-muted-foreground mt-0.5">{groupDesc}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            {leaderProfile && (
              <>
                <ProfileAvatar
                  name={leaderProfile.fullName ?? ""}
                  src={leaderProfile.avatarUrl ?? undefined}
                  size="sm"
                />
                <span className="text-xs text-muted-foreground">
                  Leader: <span className="font-medium text-foreground">{leaderProfile.fullName}</span>
                </span>
              </>
            )}
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setChangeLeaderOpen(true)}
              >
                <UserCog className="h-3 w-3" /> Ganti Leader
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(Number(v))}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(Number(v))}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canManage && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-3.5 w-3.5" /> Edit Group
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Tambah Member
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard icon={DollarSign} label="Total Penjualan" value={formatRp(totalSales)} sub={`dari target ${formatRp(totalTarget)}`} />
        <OverviewCard icon={Target} label="Achievement" value={`${overallPct}%`} sub={overallPct >= 80 ? "On track" : "Below target"} accent={overallPct >= 80} />
        <OverviewCard icon={CalendarCheck} label="Booking Confirmed" value={`${totalConfirmed}`} sub={`dari ${totalBookings} total`} />
        <OverviewCard icon={Users} label="Anggota" value={`${memberRows.length}`} sub="Sales aktif" />
      </div>

      {/* Member Revenue Chart */}
      <GroupMemberChart members={performance} />

      {/* Ranking Table */}
      <Card className="shadow-none p-0">
        <CardContent className="p-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">Ranking Anggota</span>
              <Badge variant="secondary" className="text-xs">{periodLabel}</Badge>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border bg-secondary">
                <TableHead className="px-6 py-2.5 font-semibold text-muted-foreground text-xs w-14">Rank</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Sales</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-right">Target</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-right">Penjualan</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-center">Achievement</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-center">Trend</TableHead>
                {canManage && <TableHead className="px-2 py-2.5 text-xs w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((member, idx) => {
                const rank = idx + 1;
                const isTop = rank === 1;
                const pctVal = achievementPct(member.actual, member.target);
                const overTarget = member.actual >= member.target && member.target > 0;
                const isLeader = member.profileId === group.leaderId;

                return (
                  <TableRow
                    key={member.profileId}
                    className={cn(
                      "border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer",
                      isTop && "bg-primary/[0.03]",
                    )}
                    onClick={() => setDetailMemberId(member.profileId)}
                  >
                    <TableCell className="px-6 py-3">
                      <div className="flex items-center justify-center">
                        {isTop ? (
                          <Crown className="h-5 w-5 text-yellow-400" />
                        ) : (
                          <span className={cn(
                            "text-sm font-semibold w-6 h-6 rounded-full flex items-center justify-center",
                            rank <= 3 ? "bg-secondary text-foreground" : "text-muted-foreground",
                          )}>{rank}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProfileAvatar name={member.name} src={member.avatarUrl} size="sm" />
                        <div>
                          <span className={cn("text-sm font-medium", isTop && "font-semibold")}>{member.name}</span>
                          {isLeader && (
                            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Leader</Badge>
                          )}
                          {member.pendingApproval > 0 && (
                            <span className="ml-2 text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                              {member.pendingApproval} Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right">
                      <span className="text-xs text-muted-foreground">
                        {member.target > 0 ? formatFull(member.target) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right">
                      <span className={cn("text-sm font-semibold", overTarget ? "text-foreground" : "text-muted-foreground")}>
                        {formatFull(member.actual)}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("text-xs font-semibold",
                          pctVal >= 100 ? "text-foreground" : pctVal >= 70 ? "text-muted-foreground" : "text-destructive",
                        )}>{pctVal}%</span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full",
                              pctVal >= 100 ? "bg-primary" : pctVal >= 70 ? "bg-muted-foreground" : "bg-destructive",
                            )}
                            style={{ width: `${Math.min(pctVal, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      {overTarget
                        ? <TrendingUp className="h-4 w-4 text-foreground mx-auto" />
                        : <TrendingDown className="h-4 w-4 text-muted-foreground mx-auto" />
                      }
                    </TableCell>
                    {canManage && (
                      <TableCell className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-secondary rounded cursor-pointer outline-none">
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditTargetMember({ profileId: member.profileId, name: member.name, target: member.target });
                              setTargetInput(member.target.toString());
                              setTargetFrom("");
                              setTargetTo("");
                            }}>
                              <PenLine className="h-3.5 w-3.5 mr-2" /> Edit Target
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteMember({ profileId: member.profileId, name: member.name, target: member.target })}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus dari Grup
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals & Dialogs */}

      <SalesDetailModal
        memberId={detailMemberId}
        memberName={sorted.find((m) => m.profileId === detailMemberId)?.name ?? ""}
        memberAvatarUrl={sorted.find((m) => m.profileId === detailMemberId)?.avatarUrl ?? null}
        memberTarget={sorted.find((m) => m.profileId === detailMemberId)?.target ?? 0}
        memberActual={sorted.find((m) => m.profileId === detailMemberId)?.actual ?? 0}
        onClose={() => setDetailMemberId(null)}
      />

      {isSuperAdmin && (
        <ChangeLeaderDialog
          open={changeLeaderOpen}
          onOpenChange={setChangeLeaderOpen}
          group={group}
        />
      )}

      {canManage && (
        <Drawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Edit Group">
          <div className="flex flex-col justify-between h-full">
            <div className="space-y-4 px-2">
              <div>
                <Label className="text-sm font-medium">Nama Group</Label>
                <Input className="mt-1" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Deskripsi</Label>
                <Textarea className="mt-1" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white z-10">
              <div className="flex py-4 gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSettingsOpen(false)}>Batal</Button>
                <Button className="flex-1" disabled={isPending} onClick={handleSaveSettings}>Simpan</Button>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {canManage && (
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddSearch(""); }}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Tambah Anggota</DialogTitle>
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Cari nama..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
              />
              <ScrollArea className="h-52 rounded-md border">
                <div className="p-1">
                  {availableProfiles
                    .filter((p) => (p.fullName ?? "").toLowerCase().includes(addSearch.toLowerCase()))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAddMember(p.id)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-sm text-sm hover:bg-accent text-left cursor-pointer disabled:opacity-50"
                      >
                        <ProfileAvatar name={p.fullName ?? p.id} src={p.avatarUrl ?? undefined} size="sm" />
                        <span>{p.fullName ?? p.id}</span>
                      </button>
                    ))}
                  {availableProfiles.filter((p) => (p.fullName ?? "").toLowerCase().includes(addSearch.toLowerCase())).length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada profil tersedia</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canManage && (
        <Dialog open={!!editTargetMember} onOpenChange={(open) => { if (!open) setEditTargetMember(null); }}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Edit Target — {editTargetMember?.name}</DialogTitle>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-sm">Periode</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="date" className="flex-1" value={targetFrom} onChange={(e) => setTargetFrom(e.target.value)} />
                  <span className="text-xs text-muted-foreground">s/d</span>
                  <Input type="date" className="flex-1" value={targetTo} onChange={(e) => setTargetTo(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-sm">Target Penjualan</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                  <Input
                    type="text"
                    className="pl-9"
                    value={targetInput ? Number(targetInput).toLocaleString("id-ID") : ""}
                    onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditTargetMember(null)}>Batal</Button>
              <Button className="flex-1" disabled={isPending || !targetFrom || !targetTo} onClick={handleSaveTarget}>Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canManage && (
        <ConfirmDialog
          open={!!deleteMember}
          onOpenChange={(open) => { if (!open) setDeleteMember(null); }}
          title="Hapus dari Grup"
          description={`Yakin ingin menghapus ${deleteMember?.name ?? ""} dari grup ini?`}
          confirmLabel="Hapus"
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  );
}

// ─── Overview Card ────────────────────────────────────────────────────────────

function OverviewCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-9 w-9 rounded-lg shrink-0",
            accent ? "bg-primary text-primary-foreground" : "bg-secondary",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create `app/(private)/dashboard/groups/[groupId]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  getGroupDetail,
  getGroupPerformance,
  getAvailableSalesProfiles,
} from "@/lib/queries/groups";
import { GroupDetailClient } from "./_components/GroupDetailClient";
import type { GroupDetail } from "@/lib/queries/groups";

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailPage({ params }: Props) {
  const { groupId } = await params;

  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;
  const isSuperAdmin = session.user.isSuperAdmin;
  const hasViewAll =
    isSuperAdmin || (await hasPermission(session.user.roleId, "groups", "view-all"));

  const group = await getGroupDetail(groupId);
  if (!group) notFound();

  const isLeader = group.leaderId === profileId;
  const isMember = group.members.some((m) => m.userId === profileId);

  if (!hasViewAll && !isLeader && !isMember) notFound();

  const canManage =
    isSuperAdmin ||
    isLeader ||
    (await hasPermission(session.user.roleId, "groups", "edit"));

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [performance, availableProfiles] = await Promise.all([
    getGroupPerformance(group.id, startDate, endDate),
    canManage
      ? getAvailableSalesProfiles(group.members.map((m) => m.userId))
      : Promise.resolve([]),
  ]);

  return (
    <div className="px-2 pb-6">
      <GroupDetailClient
        group={group as NonNullable<GroupDetail>}
        initialPerformance={performance}
        availableProfiles={availableProfiles}
        currentProfileId={profileId}
        canManage={canManage}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/(private)/dashboard/groups/[groupId]/
git commit -m "feat(groups): create group detail page with bar chart, ranking table, change leader dialog"
```

---

## Task 10: Update Navigation, Route Meta, and Redirects

**Files:**
- Modify: `lib/route-meta.ts`
- Modify: `app/(private)/dashboard/_components/sidebar/sidebar-config.ts`
- Modify: `app/(private)/dashboard/_components/sidebar/sidebar-nav.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Update `lib/route-meta.ts`**

Replace lines 124-132:

```ts
// OLD:
"/dashboard/my-team": {
  title: "My Team",
  subtitle: "Overview kinerja tim dan target penjualan",
},
"/dashboard/my-team/[groupId]": {
  title: "Detail Tim",
  subtitle: "Kinerja dan target penjualan tim",
  parent: "/dashboard/my-team",
},
```

With:

```ts
"/dashboard/groups": {
  title: "Groups",
  subtitle: "Kelola tim dan pantau kinerja penjualan",
},
"/dashboard/groups/[groupId]": {
  title: "Detail Group",
  subtitle: "Kinerja dan target penjualan tim",
  parent: "/dashboard/groups",
},
```

- [ ] **Step 2: Update `sidebar-config.ts`**

Replace lines 97-101 (My Team nav item):

```ts
// OLD:
{
  name: "My Team",
  href: "/dashboard/my-team",
  icon: Users,
  permission: { module: "my-team", action: "view" },
},
```

With:

```ts
{
  name: "Groups",
  href: "/dashboard/groups",
  icon: Users,
  permission: { module: "groups", action: "view" },
},
```

Also remove `"settings-groups"` from the `SETTINGS_MODULES` array (line 61) since it no longer exists:

```ts
export const SETTINGS_MODULES = [
  "settings-brands",
  "settings-venues",
  // "settings-groups" — removed, merged into groups module
  "settings-users",
  "settings-education-level",
  "settings-event-types",
  "settings-order-status",
  "settings-approval-flow",
  "settings-payment-methods",
  "settings-role-permission",
  "settings-source-of-information",
] as const;
```

- [ ] **Step 3: Update `sidebar-nav.tsx`**

Replace the special-case block for `/dashboard/my-team` (lines 38-41):

```ts
// OLD:
if (item.href === "/dashboard/my-team") {
  if (!can("my-team", "view") && !isGroupMember) return [];
  return [item];
}
```

With:

```ts
if (item.href === "/dashboard/groups") {
  if (!can("groups", "view") && !isGroupMember) return [];
  return [item];
}
```

- [ ] **Step 4: Add redirects in `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
      {
        source: "/dashboard/my-team",
        destination: "/dashboard/groups",
        permanent: true,
      },
      {
        source: "/dashboard/my-team/:groupId",
        destination: "/dashboard/groups/:groupId",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Commit**

```bash
git add lib/route-meta.ts \
  app/(private)/dashboard/_components/sidebar/sidebar-config.ts \
  app/(private)/dashboard/_components/sidebar/sidebar-nav.tsx \
  next.config.ts
git commit -m "feat(groups): update sidebar (My Team → Groups), route-meta, add old-route redirects"
```

---

## Task 11: Remove Old Files and Settings Groups Tab

**Files:**
- Modify: `app/(private)/dashboard/settings/user-management/_components/users-and-groups.tsx`
- Delete: `app/(private)/dashboard/my-team/` (folder)

- [ ] **Step 1: Remove Groups tab from `users-and-groups.tsx`**

Open `app/(private)/dashboard/settings/user-management/_components/users-and-groups.tsx`.

Remove the "Groups" tab and any import of `GroupManagement` or `groups-table`. The component should only render the "Users" tab. The final file should look like:

```tsx
"use client";

import { UsersTable } from "./UsersTable";
import type { /* UsersTable props */ } from "...";

// Keep only UsersTable rendering — Groups tab removed (moved to /dashboard/groups)
export function UsersAndGroups({ /* props for UsersTable */ }: Props) {
  return <UsersTable {/* pass through props */} />;
}
```

> **Note:** Read the full current file first, then remove only the Groups-tab-related code. Keep all UsersTable props and logic intact.

- [ ] **Step 2: Delete the old my-team folder**

```bash
git rm -r "app/(private)/dashboard/my-team/"
```

- [ ] **Step 3: Also delete now-unused components from settings**

The `group-management.tsx` and `groups-table.tsx` from settings are no longer needed (their functionality is now in the groups feature):

```bash
git rm "app/(private)/dashboard/settings/user-management/_components/group-management.tsx"
git rm "app/(private)/dashboard/settings/user-management/_components/groups-table.tsx"
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(groups): remove old my-team folder and settings groups tab/components"
```

---

## Task 12: Update AGENTS.md Permissions Table

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the permissions table in section 5**

Find the `my-team` and `settings-groups` rows in the Module/Actions table and replace with:

```markdown
| `groups` | `view`, `view-all`, `create`, `edit`, `delete` |
```

Remove the old `my-team` and `settings-groups` rows.

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update permissions table — my-team + settings-groups merged into groups"
```

---

## Task 13: Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: 0 errors. If errors appear, fix them before proceeding.

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or `Route (app)` table with no error markers.

- [ ] **Step 3: Verify redirects work (dev server)**

```bash
npm run dev
```

Open browser:
- Navigate to `http://localhost:3000/dashboard/my-team` → should redirect to `/dashboard/groups`
- Navigate to `http://localhost:3000/dashboard/groups` → should load Groups index page
- Sidebar should show "Groups" instead of "My Team"

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(groups): post-build TypeScript fixes"
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Task |
|---|---|
| Route rename my-team → groups | Task 10, 11 |
| Redirects for old routes | Task 10 |
| Permissions migration | Task 1 |
| actions/groups.ts merged | Task 2 |
| Fix callback transactions | Task 2 |
| Fix role string match | Task 4 |
| lib/queries/groups.ts merged + date filtering | Task 4 |
| API routes updated/added | Task 5 |
| Services + hooks updated | Task 6 |
| shadcn chart installed | Task 7 |
| Groups index: cards + bar chart + table | Task 8 |
| Groups detail: cards + bar chart + ranking | Task 9 |
| Ganti Leader (super admin only) | Task 9 |
| Sidebar renamed | Task 10 |
| Route meta updated | Task 10 |
| Settings groups tab removed | Task 11 |
| AGENTS.md updated | Task 12 |

**No gaps found.**
