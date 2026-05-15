# My Team — Redesign Spec

**Date:** 2026-05-15
**Status:** Approved

---

## Overview

Redesign the My Team feature so that:
- Leaders (group `leaderId`) have full management access
- Sales/members have view-only access to their team dashboard
- Users with `my-team:view-all` permission can monitor all groups via a grid
- All access control is permission-based and dynamic (not hardcoded to super admin)

---

## 1. Permission Module

New module: `my-team` with 5 actions seeded via migration SQL.

| Permission | Who gets it | What it allows |
|---|---|---|
| `my-team:view` | Manager role, Sales role | See their own team(s) |
| `my-team:create` | Manager role | Add members to team |
| `my-team:edit` | Manager role | Edit team settings, set targets |
| `my-team:delete` | Manager role | Remove members from team |
| `my-team:view-all` | Admin / configurable role | See grid of ALL groups |

Seeded via: `INSERT INTO "Permission" (module, action) VALUES ('my-team', 'view'), ... ON CONFLICT DO NOTHING`

The sidebar "My Team" menu item is visible when:
- User has `my-team:view` permission, **OR**
- User is a leader or member of at least 1 `UserGroup`

---

## 2. Routing Logic

Entry point: `app/(private)/dashboard/my-team/page.tsx` (server component, routing only).

```
Check in order:

1. Has my-team:view-all?
   → Render TeamGrid with ALL groups

2. No view-all, but is leader/member of groups:
   → Exactly 1 group → redirect to /dashboard/my-team/[groupId]
   → 2+ groups → Render TeamGrid with user's own groups only

3. No view-all, no group membership:
   → Show empty state: "Kamu belum terdaftar di tim manapun"
```

---

## 3. Grid Page (`/dashboard/my-team`)

Component: `TeamGrid.tsx`

- Layout: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Each card displays: group name, leader name, member count, monthly achievement %
- Clicking a card navigates to `/dashboard/my-team/[groupId]`
- `view-all` users see all groups; others see only their own groups

---

## 4. Detail Page (`/dashboard/my-team/[groupId]`)

URL: `/dashboard/my-team/[groupId]`

Server page determines `canManage` flag:
- `canManage = true` if `session.user.profileId === group.leaderId`
- `canManage = false` for all other users (members, view-all monitors)

`canManage` is passed as prop to `MyTeamClient`. When `false`:
- Team settings button hidden
- Add member button hidden
- Edit target / remove member dropdown items hidden
- Performance dashboard (overview cards, table) fully visible

---

## 5. File Changes

### New files
| File | Purpose |
|---|---|
| `app/(private)/dashboard/my-team/_components/TeamGrid.tsx` | Grid of group cards |
| `app/(private)/dashboard/my-team/[groupId]/page.tsx` | Detail page per group |
| `app/(private)/dashboard/my-team/[groupId]/_components/` | Move existing detail components here |

### Modified files
| File | Change |
|---|---|
| `app/(private)/dashboard/my-team/page.tsx` | Routing logic only — check permissions, redirect or render grid |
| `app/(private)/dashboard/my-team/_components/my-team-client.tsx` | Accept `canManage: boolean` prop, hide management UI when false |
| Sidebar component | Add visibility check: `my-team:view` permission OR group membership |
| `lib/queries/my-team.ts` | Add `getAllGroups()` and `getUserGroups(profileId)` |
| `lib/route-meta.ts` | Add entries for `/dashboard/my-team` and `/dashboard/my-team/[groupId]` |
| Migration SQL | Seed 5 `my-team:*` permissions |

### Unchanged
- `actions/my-team.ts` — already guards mutations with `group.leaderId === profileId`
- `sales-detail-drawer.tsx` — no changes needed
- `prisma/schema.prisma` — no model changes needed

---

## 6. Security Notes

- Server actions in `actions/my-team.ts` already enforce `group.leaderId === profileId` for all mutations — no changes needed, safe by default
- Detail page must verify user has access to the requested `[groupId]` (is leader, member, or has `view-all`) — return 404 if not
- `my-team:view-all` does not grant mutation capability — read-only monitoring only

---

## Out of Scope

- Approving bookings from detail page — existing behavior unchanged
- Creating new groups — remains in Settings
- Assigning group leaders — remains in Settings
