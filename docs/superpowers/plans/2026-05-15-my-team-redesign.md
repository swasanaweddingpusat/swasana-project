# My Team Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign My Team so leaders get full management, sales/members get view-only, and admins/view-all users can monitor all groups via a grid page.

**Architecture:** Add a `my-team` permission module (5 actions). Route `/dashboard/my-team` becomes a router that redirects single-group users directly to `/dashboard/my-team/[groupId]` or renders a grid for multi-group/view-all users. Access level (leader vs member) is determined at the detail page and passed down as `canManage: boolean`.

**Tech Stack:** Next.js 16, React 19, Prisma 7, TypeScript strict, Tailwind v4, shadcn v4, TanStack Query v5, NextAuth v5 beta, Neon HTTP adapter

---

## File Map

| Status | File | Change |
|---|---|---|
| Create | `prisma/migrations/20260515_add_my_team_permissions/migration.sql` | Seed 5 my-team permissions |
| Modify | `app/api/me/permissions/route.ts` | Add `isGroupMember` to response |
| Modify | `hooks/use-permissions.ts` | Expose `isGroupMember` |
| Modify | `app/(private)/dashboard/_components/sidebar/sidebar-config.ts` | My Team permission → `my-team:view` |
| Modify | `app/(private)/dashboard/_components/sidebar/sidebar-nav.tsx` | OR logic for My Team menu |
| Modify | `lib/queries/my-team.ts` | Add `getAllGroups`, `getUserGroups`, `getGroupDetail` |
| Create | `app/(private)/dashboard/my-team/[groupId]/_components/sales-detail-drawer.tsx` | Moved from `../_components/` |
| Create | `app/(private)/dashboard/my-team/[groupId]/_components/my-team-client.tsx` | Moved + `canManage` prop |
| Delete | `app/(private)/dashboard/my-team/_components/my-team-client.tsx` | Replaced by `[groupId]/_components/` |
| Delete | `app/(private)/dashboard/my-team/_components/sales-detail-drawer.tsx` | Replaced by `[groupId]/_components/` |
| Create | `app/(private)/dashboard/my-team/[groupId]/page.tsx` | Detail page with access control |
| Create | `app/(private)/dashboard/my-team/_components/TeamGrid.tsx` | Grid of group cards |
| Rewrite | `app/(private)/dashboard/my-team/page.tsx` | Routing logic only |
| Modify | `actions/my-team.ts` | Use `my-team:*` permissions |
| Modify | `app/api/my-team/performance/route.ts` | Use `my-team:view` |
| Modify | `lib/route-meta.ts` | Add `/dashboard/my-team/[groupId]` entry |

---

## Task 1: Migration — seed my-team permissions

**Files:**
- Create: `prisma/migrations/20260515_add_my_team_permissions/migration.sql`

- [ ] **Step 1: Create the migration directory and SQL file**

```sql
-- prisma/migrations/20260515_add_my_team_permissions/migration.sql

INSERT INTO "Permission" (id, module, action)
VALUES
  (gen_random_uuid()::text, 'my-team', 'view'),
  (gen_random_uuid()::text, 'my-team', 'create'),
  (gen_random_uuid()::text, 'my-team', 'edit'),
  (gen_random_uuid()::text, 'my-team', 'delete'),
  (gen_random_uuid()::text, 'my-team', 'view-all')
ON CONFLICT (module, action) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

```bash
npx prisma migrate deploy
```

Expected: `1 migration applied successfully` (or `No pending migrations` if already applied)

- [ ] **Step 3: Verify rows exist**

```bash
npx prisma studio
```

Open `Permission` table, confirm 5 rows with module `my-team`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260515_add_my_team_permissions/migration.sql
git commit -m "feat(my-team): seed my-team permission module"
```

---

## Task 2: Extend /api/me/permissions to include isGroupMember

**Files:**
- Modify: `app/api/me/permissions/route.ts`

Context: The sidebar needs to know if the current user belongs to at least one group (as leader OR member) to decide whether to show the My Team menu item — independent of explicit permission. Adding this to the existing permissions endpoint avoids an extra API call.

- [ ] **Step 1: Read the current file**

File: `app/api/me/permissions/route.ts` (already read above)

- [ ] **Step 2: Update the route**

Replace the entire file content with:

```ts
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/permissions";
import type { PermissionMatrix } from "@/types/user";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`me-permissions:${session.user.id}`)) return rateLimitResponse();

  const roleId = session.user.roleId;
  const profileId = session.user.profileId;

  const isAdmin = roleId ? await isSuperAdmin(roleId) : false;

  // Check if user is leader or member of any group
  const isGroupMember = profileId
    ? !!(await db.userGroup.findFirst({
        where: {
          OR: [
            { leaderId: profileId },
            { members: { some: { userId: profileId } } },
          ],
        },
        select: { id: true },
      }))
    : false;

  if (!roleId) return Response.json({ isAdmin: false, isGroupMember, permissions: {} });

  if (isAdmin) {
    const allPermissions = await db.permission.findMany();
    const matrix: PermissionMatrix = {};
    for (const p of allPermissions) {
      if (!matrix[p.module]) matrix[p.module] = {};
      matrix[p.module][p.action] = true;
    }
    return Response.json({ isAdmin: true, isGroupMember, permissions: matrix });
  }

  const rolePermissions = await db.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { module: true, action: true } } },
  });

  const matrix: PermissionMatrix = {};
  for (const rp of rolePermissions) {
    const { module, action } = rp.permission;
    if (!matrix[module]) matrix[module] = {};
    matrix[module][action] = true;
  }

  return Response.json({ isAdmin: false, isGroupMember, permissions: matrix });
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors in `app/api/me/permissions/route.ts`

- [ ] **Step 4: Commit**

```bash
git add app/api/me/permissions/route.ts
git commit -m "feat(my-team): add isGroupMember to permissions endpoint"
```

---

## Task 3: Update usePermissions hook to expose isGroupMember

**Files:**
- Modify: `hooks/use-permissions.ts`

- [ ] **Step 1: Replace file content**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { PermissionMatrix } from "@/types/user";

interface PermissionsResponse {
  isAdmin: boolean;
  isGroupMember: boolean;
  permissions: PermissionMatrix;
}

async function fetchPermissions(): Promise<PermissionsResponse> {
  const res = await fetch("/api/me/permissions");
  if (!res.ok) throw new Error("Failed to fetch permissions");
  return res.json();
}

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["me:permissions"],
    queryFn: fetchPermissions,
    staleTime: 30 * 1000,
  });

  const can = (module: string, action: string): boolean => {
    if (!data) return false;
    if (data.isAdmin) return true;
    return data.permissions?.[module]?.[action] === true;
  };

  return {
    isLoading,
    isAdmin: data?.isAdmin ?? false,
    isGroupMember: data?.isGroupMember ?? false,
    can,
    canView: (module: string) => can(module, "view"),
    canCreate: (module: string) => can(module, "create"),
    canEdit: (module: string) => can(module, "update"),
    canDelete: (module: string) => can(module, "delete"),
  };
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/use-permissions.ts
git commit -m "feat(my-team): expose isGroupMember from usePermissions"
```

---

## Task 4: Update sidebar-config.ts — change My Team permission

**Files:**
- Modify: `app/(private)/dashboard/_components/sidebar/sidebar-config.ts`

- [ ] **Step 1: Change the My Team navItem permission**

Find this block (around line 97–101):
```ts
{
  name: "My Team",
  href: "/dashboard/my-team",
  icon: Users,
  permission: { module: "booking", action: "view" },
},
```

Replace with:
```ts
{
  name: "My Team",
  href: "/dashboard/my-team",
  icon: Users,
  permission: { module: "my-team", action: "view" },
},
```

- [ ] **Step 2: Commit**

```bash
git add app/(private)/dashboard/_components/sidebar/sidebar-config.ts
git commit -m "feat(my-team): update sidebar permission to my-team:view"
```

---

## Task 5: Update sidebar-nav.tsx — OR logic for My Team visibility

**Files:**
- Modify: `app/(private)/dashboard/_components/sidebar/sidebar-nav.tsx`

Context: My Team menu should appear when the user has `my-team:view` permission OR is a member/leader of at least one group. The `filterNavItems` function handles special cases (like Settings). We add the same pattern for My Team.

- [ ] **Step 1: Update filterNavItems signature and add My Team special case**

Replace the entire file:

```tsx
"use client";

import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { navItems, SETTINGS_MODULES, type NavItem, type SubMenuItem } from "./sidebar-config";
import { NavItemRow } from "./nav-item";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "../../../../../lib/utils";

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

type CanFn = (module: string, action: string) => boolean;

function filterSubMenus(items: SubMenuItem[], can: CanFn): SubMenuItem[] {
  return items.flatMap((item) => {
    if (item.hidden) return [];
    if (item.permission && !can(item.permission.module, item.permission.action)) return [];
    if (item.submenu) {
      const filtered = filterSubMenus(item.submenu, can);
      if (!item.permission && filtered.length === 0) return [];
      return [{ ...item, submenu: filtered }];
    }
    return [item];
  });
}

function filterNavItems(items: NavItem[], can: CanFn, isGroupMember: boolean): NavItem[] {
  return items.flatMap((item) => {
    if (item.hidden) return [];
    if (item.href === "/dashboard/settings") {
      const hasSettingsAccess = SETTINGS_MODULES.some((mod) => can(mod, "view"));
      if (!hasSettingsAccess) return [];
      return [item];
    }
    if (item.href === "/dashboard/my-team") {
      if (!can("my-team", "view") && !isGroupMember) return [];
      return [item];
    }
    if (item.permission && !can(item.permission.module, item.permission.action)) return [];
    if (item.submenu) {
      const filtered = filterSubMenus(item.submenu, can);
      if (!item.permission && filtered.length === 0) return [];
      return [{ ...item, submenu: filtered }];
    }
    return [item];
  });
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { can, isLoading, isGroupMember } = usePermissions();
  const visibleItems = isLoading ? [] : filterNavItems(navItems, can, isGroupMember);

  return (
    <>
      {/* Logo */}
      <div className={cn('sticky', 'top-0', 'bg-white', 'z-10', 'border-b', 'border-gray-200', 'h-16', 'flex', 'items-center', 'px-5')}>
        {collapsed ? (
          <div className={cn('w-full', 'flex', 'justify-center')}>
            <Image
              src="/logo-sgp.svg"
              alt="SGP"
              width={100}
              height={100}
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
        ) : (
          <Image
            src="/logo-swasana.svg"
            alt="Swasana Wedding"
            width={100}
            height={100}
            style={{ width: "65%", height: "auto" }}
            priority
          />
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1', 'p-4', 'space-y-2', 'overflow-y-auto', 'overflow-x-hidden')} onClick={onNavigate}>
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={collapsed ? "flex justify-center py-3" : "flex items-center gap-3 px-3 py-2"}>
                <Skeleton className={cn('h-5', 'w-5', 'shrink-0', 'rounded')} />
                {!collapsed && <Skeleton className={cn('h-4', 'rounded')} style={{ width: `${60 + (i % 3) * 15}%` }} />}
              </div>
            ))
          : visibleItems.map((item) => (
              <NavItemRow key={item.href} item={item} collapsed={collapsed} />
            ))}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/(private)/dashboard/_components/sidebar/sidebar-nav.tsx
git commit -m "feat(my-team): show My Team menu for permission OR group membership"
```

---

## Task 6: Extend lib/queries/my-team.ts — add new query functions

**Files:**
- Modify: `lib/queries/my-team.ts`

Add three new functions: `getAllGroups` (for view-all users), `getUserGroups` (groups user belongs to as leader OR member), and `getGroupDetail` (group by ID for the detail page).

- [ ] **Step 1: Add new functions and types at the bottom of `lib/queries/my-team.ts`**

Append after the existing `getAvailableSalesProfiles` function (before the `// ─── Return types` section):

```ts
/** Fetch all groups — for users with my-team:view-all permission */
export async function getAllGroups() {
  "use cache";
  cacheTag("my-team", "groups");
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

/** Fetch groups where profileId is leader OR member */
export async function getUserGroups(profileId: string) {
  "use cache";
  cacheTag("my-team", "groups");
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

/** Fetch a single group by ID with full member list (for detail page) */
export async function getGroupDetail(groupId: string) {
  "use cache";
  cacheTag("my-team", "groups");
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
          profile: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}
```

Also add the return types at the bottom of the file (after the existing type exports):

```ts
export type GroupCard = Awaited<ReturnType<typeof getAllGroups>>[number];
export type GroupDetail = Awaited<ReturnType<typeof getGroupDetail>>;
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/queries/my-team.ts
git commit -m "feat(my-team): add getAllGroups, getUserGroups, getGroupDetail queries"
```

---

## Task 7: Move SalesDetailDrawer to [groupId]/_components/

**Files:**
- Create: `app/(private)/dashboard/my-team/[groupId]/_components/sales-detail-drawer.tsx`

The content is identical to the old file — only the location changes. The `@/` aliases in imports work from any location.

- [ ] **Step 1: Read the current file in full**

Read: `app/(private)/dashboard/my-team/_components/sales-detail-drawer.tsx`

- [ ] **Step 2: Create the new file at the new location**

Create `app/(private)/dashboard/my-team/[groupId]/_components/sales-detail-drawer.tsx` with the exact same content as the file you just read.

- [ ] **Step 3: Verify new file compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit (do NOT delete old file yet — MyTeamClient still imports it)**

```bash
git add "app/(private)/dashboard/my-team/[groupId]/_components/sales-detail-drawer.tsx"
git commit -m "feat(my-team): add sales-detail-drawer to [groupId]/_components"
```

---

## Task 8: Create updated MyTeamClient in [groupId]/_components/

**Files:**
- Create: `app/(private)/dashboard/my-team/[groupId]/_components/my-team-client.tsx`

This is the existing `my-team-client.tsx` with two changes:
1. `canManage: boolean` prop added to `Props`
2. Management UI elements hidden when `canManage` is `false`

- [ ] **Step 1: Create the new file**

Create `app/(private)/dashboard/my-team/[groupId]/_components/my-team-client.tsx` with the content below. Key changes from the original are marked with `// CHANGED`:

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
  Plus, Settings, MoreHorizontal, PenLine, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SalesDetailModal } from "./sales-detail-drawer";
import {
  updateMyTeamSettings,
  addMyTeamMember,
  removeMyTeamMember,
  setMemberTarget,
} from "@/actions/my-team";
import type { MyTeamGroup, MyTeamPerformanceItem, AvailableSalesProfile } from "@/lib/queries/my-team";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  group: NonNullable<MyTeamGroup>;
  initialPerformance: MyTeamPerformanceItem[];
  availableProfiles: AvailableSalesProfile[];
  currentProfileId: string;
  canManage: boolean; // CHANGED: new prop
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ─── Component ────────────────────────────────────────────────────────────────

export function MyTeamClient({ group, initialPerformance, availableProfiles, currentProfileId: _currentProfileId, canManage }: Props) {
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

  const { data: performance = initialPerformance } = useQuery<MyTeamPerformanceItem[]>({
    queryKey: ["my-team-performance", group.id, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ groupId: group.id, startDate, endDate });
      const res = await fetch(`/api/my-team/performance?${params}`);
      if (!res.ok) return initialPerformance;
      return res.json();
    },
    initialData: initialPerformance,
    staleTime: 60_000,
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamName, setTeamName] = useState(group.name);
  const [teamDesc, setTeamDesc] = useState(group.description ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");

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

  function handleSaveSettings() {
    startTransition(async () => {
      const res = await updateMyTeamSettings({ id: group.id, name: teamName, description: teamDesc });
      if (res.success) {
        toast.success("Pengaturan tim disimpan");
        setSettingsOpen(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleAddMember(profileId: string) {
    startTransition(async () => {
      const res = await addMyTeamMember(group.id, profileId);
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
      const res = await removeMyTeamMember(group.id, deleteMember.profileId);
      if (res.success) {
        toast.success(`${deleteMember.name} dihapus dari tim`);
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
      {/* Team Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">{teamName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{teamDesc}</p>
        </div>
        <div className="flex items-center gap-2">
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
          {/* CHANGED: only render settings button for managers */}
          {canManage && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-3.5 w-3.5" /> Pengaturan
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard icon={DollarSign} label="Total Penjualan" value={formatRp(totalSales)} sub={`dari target ${formatRp(totalTarget)}`} />
        <OverviewCard icon={Target} label="Achievement" value={`${overallPct}%`} sub={overallPct >= 80 ? "On track" : "Below target"} accent={overallPct >= 80} />
        <OverviewCard icon={CalendarCheck} label="Booking Confirmed" value={`${totalConfirmed}`} sub={`dari ${totalBookings} total booking`} />
        <OverviewCard icon={Users} label="Anggota Tim" value={`${memberRows.length}`} sub="Sales aktif" />
      </div>

      {/* Sales Performance Table */}
      <Card className="shadow-none p-0">
        <CardContent className="p-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">Sales Performance</span>
              <Badge variant="secondary" className="text-xs">{periodLabel}</Badge>
            </div>
            {/* CHANGED: only render add button for managers */}
            {canManage && (
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Tambah Sales
              </Button>
            )}
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
                {/* CHANGED: only render actions column header for managers */}
                {canManage && <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((member, idx) => {
                const rank = idx + 1;
                const isTop = rank === 1;
                const pctVal = achievementPct(member.actual, member.target);
                const overTarget = member.actual >= member.target && member.target > 0;

                return (
                  <TableRow
                    key={member.profileId}
                    className={cn(
                      "border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer",
                      isTop && "bg-primary/[0.03]"
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
                            rank <= 3 ? "bg-secondary text-foreground" : "text-muted-foreground"
                          )}>{rank}</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProfileAvatar name={member.name} src={member.avatarUrl ?? undefined} size="sm" />
                        <div>
                          <span className={cn("text-sm font-medium", isTop && "font-semibold")}>{member.name}</span>
                          {isTop && (
                            <span className="ml-2 text-[10px] font-semibold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full">Top Performer</span>
                          )}
                          {member.pendingApproval > 0 && (
                            <span className="ml-2 text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                              {member.pendingApproval} Pending Approval
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
                        <span className={cn(
                          "text-xs font-semibold",
                          pctVal >= 100 ? "text-foreground" : pctVal >= 70 ? "text-muted-foreground" : "text-destructive"
                        )}>{pctVal}%</span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pctVal >= 100 ? "bg-primary" : pctVal >= 70 ? "bg-muted-foreground" : "bg-destructive"
                            )}
                            style={{ width: `${Math.min(pctVal, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-3 text-center">
                      {overTarget ? (
                        <TrendingUp className="h-4 w-4 text-foreground mx-auto" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>

                    {/* CHANGED: only render actions cell for managers */}
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
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus dari Tim
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

      {/* Sales Detail Modal */}
      <SalesDetailModal
        memberId={detailMemberId}
        memberName={sorted.find((m) => m.profileId === detailMemberId)?.name ?? ""}
        memberAvatarUrl={sorted.find((m) => m.profileId === detailMemberId)?.avatarUrl ?? null}
        memberTarget={sorted.find((m) => m.profileId === detailMemberId)?.target ?? 0}
        memberActual={sorted.find((m) => m.profileId === detailMemberId)?.actual ?? 0}
        onClose={() => setDetailMemberId(null)}
      />

      {/* Team Settings Drawer — only rendered for managers */}
      {canManage && (
        <Drawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Pengaturan Team">
          <div className="flex flex-col justify-between h-full">
            <div className="space-y-4 px-2">
              <div>
                <Label className="text-sm font-medium">Nama Team</Label>
                <Input className="mt-1" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Nama team" />
              </div>
              <div>
                <Label className="text-sm font-medium">Deskripsi</Label>
                <Textarea className="mt-1" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} placeholder="Deskripsi team" rows={3} />
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

      {/* Add Member Dialog — only rendered for managers */}
      {canManage && (
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddSearch(""); }}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Tambah Anggota</DialogTitle>
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Cari sales..."
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
                    <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada sales tersedia</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Target Dialog — only rendered for managers */}
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

      {/* Delete Confirm — only rendered for managers */}
      {canManage && (
        <ConfirmDialog
          open={!!deleteMember}
          onOpenChange={(open) => { if (!open) setDeleteMember(null); }}
          title="Hapus dari Tim"
          description={`Yakin ingin menghapus ${deleteMember?.name ?? ""} dari tim ini?`}
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
            accent ? "bg-primary text-primary-foreground" : "bg-secondary"
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

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/my-team/[groupId]/_components/my-team-client.tsx"
git commit -m "feat(my-team): add canManage prop to MyTeamClient in [groupId]/_components"
```

---

## Task 9: Create [groupId]/page.tsx — detail page

**Files:**
- Create: `app/(private)/dashboard/my-team/[groupId]/page.tsx`

This page loads the group, checks that the current user has access, determines `canManage`, and renders `MyTeamClient`.

- [ ] **Step 1: Create the file**

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { getGroupDetail, getMyTeamPerformance, getAvailableSalesProfiles } from "@/lib/queries/my-team";
import { MyTeamClient } from "./_components/my-team-client";

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function MyTeamDetailPage({ params }: Props) {
  const { groupId } = await params;

  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;

  const isAdmin = await isSuperAdmin(session.user.roleId);
  const hasViewAll = isAdmin || await hasPermission(session.user.roleId, "my-team", "view-all");

  const group = await getGroupDetail(groupId);
  if (!group) notFound();

  const isLeader = group.leaderId === profileId;
  const isMember = group.members.some((m) => m.userId === profileId);

  if (!hasViewAll && !isLeader && !isMember) notFound();

  const canManage = isLeader;

  const [performance, availableProfiles] = await Promise.all([
    getMyTeamPerformance(group.id),
    canManage ? getAvailableSalesProfiles(group.members.map((m) => m.userId)) : Promise.resolve([]),
  ]);

  return (
    <div className="px-2 pb-6">
      <MyTeamClient
        group={group}
        initialPerformance={performance}
        availableProfiles={availableProfiles}
        currentProfileId={profileId}
        canManage={canManage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/my-team/[groupId]/page.tsx"
git commit -m "feat(my-team): add [groupId] detail page with canManage logic"
```

---

## Task 10: Create TeamGrid component

**Files:**
- Create: `app/(private)/dashboard/my-team/_components/TeamGrid.tsx`

Grid of group cards displayed on the `/dashboard/my-team` index page.

- [ ] **Step 1: Create the file**

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Users } from "lucide-react";
import type { GroupCard } from "@/lib/queries/my-team";

interface Props {
  groups: GroupCard[];
}

export function TeamGrid({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-secondary">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Belum ada tim</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Tidak ada tim yang tersedia untuk ditampilkan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Link key={group.id} href={`/dashboard/my-team/${group.id}`}>
            <Card className="shadow-none hover:bg-secondary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{group.name}</p>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{group.description}</p>
                    )}
                  </div>

                  {group.leader && (
                    <div className="flex items-center gap-2">
                      <ProfileAvatar
                        name={group.leader.fullName ?? "—"}
                        src={group.leader.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">Leader</p>
                        <p className="text-xs font-medium text-foreground">{group.leader.fullName ?? "—"}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{group._count.members} anggota</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/my-team/_components/TeamGrid.tsx"
git commit -m "feat(my-team): add TeamGrid component for group listing"
```

---

## Task 11: Rewrite main page.tsx as routing logic

**Files:**
- Modify: `app/(private)/dashboard/my-team/page.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { getAllGroups, getUserGroups } from "@/lib/queries/my-team";
import { TeamGrid } from "./_components/TeamGrid";
import { Users } from "lucide-react";

export default async function MyTeamPage() {
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;

  const isAdmin = await isSuperAdmin(session.user.roleId);
  const hasViewAll = isAdmin || await hasPermission(session.user.roleId, "my-team", "view-all");

  if (hasViewAll) {
    const groups = await getAllGroups();
    return <TeamGrid groups={groups} />;
  }

  const myGroups = await getUserGroups(profileId);

  if (myGroups.length === 1) {
    redirect(`/dashboard/my-team/${myGroups[0].id}`);
  }

  if (myGroups.length > 1) {
    return <TeamGrid groups={myGroups} />;
  }

  // No groups and no view-all — check for explicit permission
  const hasView = await hasPermission(session.user.roleId, "my-team", "view");
  if (!hasView) redirect("/dashboard?error=forbidden");

  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-4">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-secondary">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Belum ada tim</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Anda belum tergabung dalam tim manapun. Hubungi admin untuk membuat atau bergabung ke tim.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Delete the old component files (no longer imported from here)**

```bash
git rm "app/(private)/dashboard/my-team/_components/my-team-client.tsx"
git rm "app/(private)/dashboard/my-team/_components/sales-detail-drawer.tsx"
```

- [ ] **Step 4: Commit**

```bash
git add "app/(private)/dashboard/my-team/page.tsx"
git commit -m "feat(my-team): rewrite page.tsx as routing logic, remove old _components"
```

---

## Task 12: Update actions/my-team.ts — use my-team:* permissions

**Files:**
- Modify: `actions/my-team.ts`

Currently all mutations check `booking:view`. Update each to use the correct `my-team` action.

- [ ] **Step 1: Update `updateMyTeamSettings` — change permission to `my-team:edit`**

Find (line 15):
```ts
const permResult = await requirePermission({ module: "booking", action: "view" });
if (permResult.error) return { success: false, error: permResult.error };
const session = permResult.session!;
```

Replace with:
```ts
const { session, error } = await requirePermission({ module: "my-team", action: "edit" });
if (error) return { success: false, error };
```

Also update the rate limit key reference — `session.user.id` (this is already correct after the destructuring change).

- [ ] **Step 2: Update `addMyTeamMember` — change permission to `my-team:create`**

Find (line 65):
```ts
const permResult = await requirePermission({ module: "booking", action: "view" });
if (permResult.error) return { success: false, error: permResult.error };
const session = permResult.session!;
```

Replace with:
```ts
const { session, error } = await requirePermission({ module: "my-team", action: "create" });
if (error) return { success: false, error };
```

- [ ] **Step 3: Update `removeMyTeamMember` — change permission to `my-team:delete`**

Find (line 98):
```ts
const permResult = await requirePermission({ module: "booking", action: "view" });
if (permResult.error) return { success: false, error: permResult.error };
const session = permResult.session!;
```

Replace with:
```ts
const { session, error } = await requirePermission({ module: "my-team", action: "delete" });
if (error) return { success: false, error };
```

- [ ] **Step 4: Update `setMemberTarget` — change permission to `my-team:edit`**

Find (line 126):
```ts
const permResult = await requirePermission({ module: "booking", action: "view" });
if (permResult.error) return { success: false, error: permResult.error };
const session = permResult.session!;
```

Replace with:
```ts
const { session, error } = await requirePermission({ module: "my-team", action: "edit" });
if (error) return { success: false, error };
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. Note: `approveBooking` keeps `booking:edit` — do NOT change it.

- [ ] **Step 6: Commit**

```bash
git add actions/my-team.ts
git commit -m "feat(my-team): use my-team:* permissions in server actions"
```

---

## Task 13: Update /api/my-team/performance/route.ts

**Files:**
- Modify: `app/api/my-team/performance/route.ts`

- [ ] **Step 1: Replace the permission check**

Find (line 6):
```ts
const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
```

Replace with:
```ts
const { session, response } = await requirePermissionForRoute({ module: "my-team", action: "view" });
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/my-team/performance/route.ts
git commit -m "feat(my-team): use my-team:view in performance API route"
```

---

## Task 14: Update lib/route-meta.ts

**Files:**
- Modify: `lib/route-meta.ts`

- [ ] **Step 1: Add the [groupId] route entry**

Find the existing My Team entry:
```ts
"/dashboard/my-team": {
  title: "My Team",
  subtitle: "Overview kinerja tim dan target penjualan",
},
```

Add below it:
```ts
"/dashboard/my-team/[groupId]": {
  title: "Detail Tim",
  subtitle: "Kinerja dan target penjualan tim",
  parent: "/dashboard/my-team",
},
```

Note: Next.js dynamic segments in breadcrumbs typically need pathname matching. The `getBreadcrumbs` function does exact key lookup — the `[groupId]` entry is a fallback pattern for the header title display.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/route-meta.ts
git commit -m "feat(my-team): add [groupId] route meta entry"
```

---

## Task 15: Final build verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors. Note any warnings but treat errors as blockers.

- [ ] **Step 2: Manual smoke test checklist**

Test with three user types:

**Super admin (or user with `my-team:view-all`):**
- Open `/dashboard/my-team` → should see grid of ALL groups (3-col)
- Click a group card → lands on detail page, no management buttons (unless also leader)

**Manager (group leader — `leaderId === profileId`):**
- Open `/dashboard/my-team` → if only 1 group, should redirect to `/dashboard/my-team/[groupId]`
- Detail page shows: Pengaturan button, Tambah Sales button, dropdown with Edit Target / Hapus

**Sales (group member, NOT leader):**
- Open `/dashboard/my-team` → if only 1 group, should redirect to `/dashboard/my-team/[groupId]`
- Detail page shows: performance dashboard only. No Pengaturan, no Tambah Sales, no dropdown menus.

**User with no group and no my-team permission:**
- `/dashboard/my-team` → redirected to `/dashboard?error=forbidden`
- My Team menu should NOT appear in sidebar

- [ ] **Step 3: Commit if any minor fixes were needed during smoke test**

```bash
git add -p
git commit -m "fix(my-team): smoke test corrections"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Permission module (Task 1) — seeds 5 `my-team:*` permissions
- ✅ Sidebar visibility: `my-team:view` OR group membership (Tasks 4, 5)
- ✅ Routing: view-all → grid all, single group → redirect, multiple groups → grid own (Task 11)
- ✅ Grid 3-col responsive (Task 10)
- ✅ Detail page: canManage derived from leaderId === profileId (Task 9)
- ✅ Sales view-only: management UI hidden when canManage=false (Task 8)
- ✅ Server action permissions updated to my-team:* (Task 12)
- ✅ Detail page access: 404 for unauthorized access to specific groupId (Task 9)

**Type consistency:**
- `GroupCard` defined in `lib/queries/my-team.ts` and used in `TeamGrid.tsx` ✅
- `GroupDetail` return type from `getGroupDetail` matches what `[groupId]/page.tsx` passes to `MyTeamClient` as `NonNullable<MyTeamGroup>` — note: `getGroupDetail` returns the same shape as `getMyTeamGroup` (same select fields) so `MyTeamGroup` type covers both ✅
- `canManage: boolean` added to `Props` in `MyTeamClient` and passed from both call sites ✅
