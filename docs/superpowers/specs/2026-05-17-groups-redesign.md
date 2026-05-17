# Groups Feature Redesign

**Date:** 2026-05-17  
**Status:** Approved  
**Replaces:** `my-team` feature + groups tab di `settings/user-management`

---

## Overview

Dua feature yang sebelumnya terpisah — **My Team** (performance dashboard) dan **Groups tab** di Settings → Users & Groups — digabung menjadi satu feature bernama **Groups**. Feature ini naik jadi top-level navigation item di sidebar, menggantikan "My Team".

Super admin mendapat kemampuan eksplisit untuk mengganti leader per group langsung dari dalam feature ini.

---

## Routes

| Route | Sebelumnya |
|---|---|
| `/dashboard/groups` | `/dashboard/my-team` |
| `/dashboard/groups/[groupId]` | `/dashboard/my-team/[groupId]` |

Route lama diredirect ke route baru via `proxy.ts` / Next.js redirect config.

Settings groups tab (`/dashboard/settings/users` tab Groups) dihapus. `/dashboard/settings/groups` sudah redirect ke `/dashboard/settings/users` — redirect ini tetap dipertahankan tapi tab Groups di `UsersAndGroups` component dihapus.

---

## Halaman Index — `/dashboard/groups`

### Access
- User dengan `groups:view` → lihat groups di mana dia terdaftar sebagai leader atau member
- User dengan `groups:view-all` (atau `isSuperAdmin`) → lihat semua groups
- 0 groups dan tidak punya permission → redirect `/dashboard?error=forbidden`

### Layout (atas ke bawah)

**1. Page header**
- Title: "Groups", subtitle: "Kelola tim dan pantau kinerja penjualan"
- Kanan: filter bulan/tahun (Select) + tombol "+ New Group" (hanya jika `groups:create`)

**2. Summary cards** (4 kartu, nilai berubah sesuai filter periode)
- Total Groups
- Total Sales (aggregate semua groups yang visible)
- Avg Achievement %
- Total Booking Confirmed

**3. Bar chart** — "Perbandingan Revenue per Group"
- Komponen: Shadcn `BarChart` (Recharts)
- X-axis: nama group, Y-axis: revenue (Rupiah)
- Data: revenue per group untuk periode yang dipilih
- Monochrome — semua bar warna `foreground` (hitam) dengan opacity 100%. Tidak ada pewarnaan berbeda per bar; distinqsi visual dari tinggi batang saja.

**4. Tabel Groups**
- Kolom: Nama Group, Leader, Anggota, Total Sales, Achievement (progress bar + %), Booking Confirmed, Aksi
- Aksi: tombol "Edit" (jika `groups:edit`) + icon `→` (selalu ada, navigate ke detail)
- Klik nama group atau icon `→` → navigate ke `/dashboard/groups/[groupId]`
- Achievement column: progress bar visual + persentase

---

## Halaman Detail — `/dashboard/groups/[groupId]`

### Access
- Leader atau member dari group tersebut → bisa akses
- User dengan `groups:view-all` atau `isSuperAdmin` → bisa akses semua
- Selain itu → redirect `/dashboard/groups?error=forbidden`

### Layout (atas ke bawah)

**1. Page header**
- Breadcrumb: Groups → [Nama Group]
- Title: nama group
- Sub-header: avatar + nama leader + tombol "Ganti Leader" (**hanya super admin**)
- Kanan atas: tombol "Edit Group" (jika `groups:edit`) + "+ Tambah Member" (jika `groups:create`)

**2. Filter periode** — bulan/tahun (Select, kanan atas)

**3. Summary cards** (4 kartu)
- Total Sales group periode ini
- Achievement % (actual vs target)
- Booking Confirmed
- Jumlah Anggota

**4. Bar chart** — "Revenue per Anggota"
- X-axis: nama member, Y-axis: revenue
- Sorted descending by revenue
- Monochrome

**5. Ranking table — Anggota**
- Kolom: Rank (#), Nama, Actual Sales, Target, %, Booking Confirmed, Aksi
- Badge "Leader" di samping nama leader group
- Aksi per baris:
  - "Set Target" → drawer/modal input target (jika `groups:edit`)
  - "Kick" (remove member) → konfirmasi dialog (jika `groups:delete`)
- Klik baris → buka `SalesDetailModal` (list booking + tombol Approve jika `booking:edit`)

---

## Fitur: Ganti Leader (Super Admin Only)

Tombol "Ganti Leader" muncul di header halaman detail, **hanya jika `isSuperAdmin === true`**.

Behavior:
- Klik → buka `Dialog` (Shadcn) dengan `Select` berisi list member group yang aktif, pilih satu sebagai leader baru
- Konfirmasi → panggil action `updateGroupLeader(groupId, newLeaderId)`
- Action: update `UserGroup.leaderId`, log audit, revalidate tag

Action ini terpisah dari `updateGroup` yang general — single-responsibility dan permission-check-nya spesifik (`isSuperAdmin` check di server, bukan permission tuple biasa).

---

## Permissions

### Mapping dari lama ke baru

| Lama | Baru |
|---|---|
| `my-team:view` | `groups:view` |
| `my-team:view-all` | `groups:view-all` |
| `my-team:create` | `groups:create` |
| `my-team:edit` | `groups:edit` |
| `my-team:delete` | `groups:delete` |
| `settings-groups:view` | `groups:view` (merged) |
| `settings-groups:create` | `groups:create` (merged) |
| `settings-groups:edit` | `groups:edit` (merged) |
| `settings-groups:delete` | `groups:delete` (merged) |

`settings-groups:*` permissions dihapus dari DB (migration). Seed data yang assign `settings-groups:*` ke roles diupdate ke `groups:*`.

### Permission table baru di AGENTS.md

| Module | Actions |
|---|---|
| `groups` | `view`, `view-all`, `create`, `edit`, `delete` |

---

## Data & API Changes

### Tidak ada perubahan schema Prisma
`UserGroup`, `UserGroupMember`, `UserTarget` tetap sama. Hanya routing, permissions, dan UI yang berubah.

### Actions
- `actions/my-team.ts` → rename ke `actions/groups.ts`
- `actions/group.ts` (existing settings actions) → merge ke `actions/groups.ts`, hapus `actions/group.ts`
- Tambah action baru: `updateGroupLeader(groupId, newLeaderId)` — super admin only

### Queries
- `lib/queries/my-team.ts` → merge/rename ke `lib/queries/groups.ts`
- `lib/queries/groups.ts` (existing) → merge, hapus duplikat
- Tambah `getGroupsWithPerformance(profileId?, startDate, endDate)` untuk index page yang butuh performance data

### Hooks
- `hooks/use-groups.ts` (existing) — update permission references
- Tambah `hooks/useGroupsPerformance.ts` untuk index page stats + chart data

### API Routes
- `app/api/groups/route.ts` → update permission guard ke `groups:view`
- `app/api/my-team/performance/route.ts` → pindah ke `app/api/groups/[groupId]/performance/route.ts`
- Tambah `app/api/groups/performance/route.ts` untuk aggregate index page stats

### Services
- `services/group-service.ts` → update + tambah method untuk performance data

---

## Route Meta Updates

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

---

## Sidebar Update

- Entry "My Team" → rename ke "Groups"
- Route: `/dashboard/groups`
- Permission guard: `groups:view`
- Icon: `Users` (Lucide) — sama seperti yang dipakai di group-management existing

---

## Files to Delete / Remove

| File / Bagian | Alasan |
|---|---|
| `app/(private)/dashboard/my-team/` (folder) | Diganti `groups/` |
| `app/(private)/dashboard/settings/user-management/_components/group-management.tsx` | Folderingnya dipindah ke groups feature |
| `app/(private)/dashboard/settings/user-management/_components/groups-table.tsx` | Same |
| Tab "Groups" di `users-and-groups.tsx` | Dihapus, hanya tab Users yang tersisa |
| `actions/group.ts` | Dimerge ke `actions/groups.ts` |
| `lib/queries/my-team.ts` | Dimerge ke `lib/queries/groups.ts` |
| `app/api/my-team/` folder | Pindah ke `app/api/groups/` |

---

## Migration

1. Tambah permissions baru `groups:*` ke tabel `Permission` (migration SQL)
2. Assign `groups:*` ke roles yang sebelumnya punya `my-team:*` dan `settings-groups:*`
3. Hapus `my-team:*` dan `settings-groups:*` dari DB
4. JWT refresh otomatis akan update cached permissions saat user login berikutnya

---

## Known Issues yang Diperbaiki (bonus)

Dua bug yang ditemukan saat eksplorasi, diperbaiki sekalian dalam implementasi ini:

1. **Callback transaction di Neon HTTP** — `addMyTeamMember` dan `setMemberTarget` saat ini pakai `db.$transaction(async tx => ...)` yang tidak supported Neon HTTP. Diubah ke array form.
2. **String match role** — `getAvailableSalesProfiles` filter by `role.name === "sales"`. Diubah ke filter by permission atau role flag yang proper.

---

## Out of Scope

- Drag-and-drop reorder groups/members (dari existing group-management) — **tidak dibawa** ke feature baru. Jika dibutuhkan, tambahkan di iterasi berikutnya.
- Approve booking dari detail page — **tetap ada**, tidak berubah (menggunakan `booking:edit` permission).
- Signature pad untuk approve — **tetap ada**, tidak berubah.
