# Vendor Specialist — Phase 1 Spec

**Date:** 2026-05-17
**Status:** Approved
**Phase:** 1 of 2 (copy features; Phase 2 removes them from Booking)

---

## Overview

Tambah menu baru **Vendor Specialist** di sidebar, posisi antara Calendar Event dan Groups. Halaman ini menampilkan tabel booking (duplikat dari Booking feature) dengan fokus 3 aksi per baris: **Set Vendor**, **Catering**, **Decoration**. Semua komponen di-copy (bukan di-import) dari `bookings/` ke folder baru `vendor-specialist/`.

Booking feature **tidak diubah** di Phase 1.

---

## Sidebar

Posisi baru di `sidebar-config.ts`:
```
Booking            (booking:view)
Calendar Event     (booking:view)
Vendor Specialist  (vendor-specialist:view)   ← NEW
Groups             (groups:view)
Finance            (finance-ar:view)
```

Entry baru (tidak ada submenu):
```ts
{
  name: "Vendor Specialist",
  href: "/dashboard/vendor-specialist",
  icon: Wrench,
  permission: { module: "vendor-specialist", action: "view" },
}
```

Entry lama vendor-specialist (dengan `hidden: true` dan 5 submenu item) **dihapus** dari sidebar config — diganti entry baru di atas.

---

## Route & Halaman

**Route:** `/dashboard/vendor-specialist`

**route-meta.ts** entry baru:
```ts
"/dashboard/vendor-specialist": {
  title: "Vendor Specialist",
  subtitle: "Kelola set vendor, catering, dan dekorasi per booking",
}
```

---

## Page Structure

```
app/(private)/dashboard/vendor-specialist/
├── page.tsx                              # Server component
└── _components/
    ├── VendorSpecialistClient.tsx        # Client wrapper (dynamic import)
    ├── VendorSpecialistTable.tsx         # Main table
    ├── SetVendorDrawer.tsx               # Copy dari bookings/_components/
    ├── CateringSelectionDrawer.tsx       # Copy dari bookings/_components/
    ├── DecorationSelectionDrawer.tsx     # Copy dari bookings/_components/
    └── _catering/                        # Copy dari bookings/_components/_catering/
        └── (semua helper files)
```

---

## `page.tsx` — Server Component

```tsx
// Fetch data sama seperti bookings/page.tsx
- requirePagePermission("vendor-specialist")
- getBookings(profileId, dataScope)  // dari lib/queries/bookings.ts
- getSalesProfiles()
- Pass ke VendorSpecialistClient
```

---

## `VendorSpecialistTable.tsx` — Tabel Kolom

Disederhanakan dari `bookings-table.tsx`. Hanya kolom yang relevan untuk vendor management:

| # | Kolom | Isi |
|---|---|---|
| 1 | No | Row number |
| 2 | Customer | Nama customer, phone, badge status booking |
| 3 | Venue & PO | Nama venue, PO number |
| 4 | Package | Nama package, variant |
| 5 | Event Date | Tanggal event |
| 6 | Approval | Badge status approval |
| 7 | Aksi | 3 icon buttons: Set Vendor · Catering · Decoration |

**Row actions (3 icon buttons):**
- `Wrench` icon → buka `SetVendorDrawer`
- `UtensilsCrossed` icon → buka `CateringSelectionDrawer`
- `Palette` icon → buka `DecorationSelectionDrawer`

Filter, search, pagination — sama seperti bookings table (reuse pattern).

---

## Copied Components

Komponen berikut di-copy apa adanya, lalu update import path yang berbeda:

| Source | Destination | Update import |
|---|---|---|
| `bookings/_components/set-vendor-drawer.tsx` | `vendor-specialist/_components/SetVendorDrawer.tsx` | Tidak ada perubahan (actions tetap dari `@/actions/`) |
| `bookings/_components/catering-selection-drawer.tsx` | `vendor-specialist/_components/CateringSelectionDrawer.tsx` | Tidak ada perubahan |
| `bookings/_components/decoration-selection-drawer.tsx` | `vendor-specialist/_components/DecorationSelectionDrawer.tsx` | Tidak ada perubahan |
| `bookings/_components/_catering/` (all files) | `vendor-specialist/_components/_catering/` | Update relative imports antar file dalam folder |

---

## Permissions

### Modul baru: `vendor-specialist`
Actions: `view`, `create`, `edit`, `delete`

### Migration baru
`prisma/migrations/20260517_add_vendor_specialist_permissions/migration.sql`:
```sql
INSERT INTO "permissions" (id, module, action) VALUES
  (gen_random_uuid()::text, 'vendor-specialist', 'view'),
  (gen_random_uuid()::text, 'vendor-specialist', 'create'),
  (gen_random_uuid()::text, 'vendor-specialist', 'edit'),
  (gen_random_uuid()::text, 'vendor-specialist', 'delete')
ON CONFLICT (module, action) DO NOTHING;
```

### AGENTS.md — tambah ke permission table
```
| `vendor-specialist` | `view`, `create`, `edit`, `delete` |
```

---

## Files to Create / Modify

| Action | File |
|---|---|
| **Create** | `app/(private)/dashboard/vendor-specialist/page.tsx` |
| **Create** | `app/(private)/dashboard/vendor-specialist/_components/VendorSpecialistClient.tsx` |
| **Create** | `app/(private)/dashboard/vendor-specialist/_components/VendorSpecialistTable.tsx` |
| **Copy+modify** | `vendor-specialist/_components/SetVendorDrawer.tsx` |
| **Copy+modify** | `vendor-specialist/_components/CateringSelectionDrawer.tsx` |
| **Copy+modify** | `vendor-specialist/_components/DecorationSelectionDrawer.tsx` |
| **Copy+modify** | `vendor-specialist/_components/_catering/` (all helper files) |
| **Modify** | `sidebar-config.ts` — remove hidden entry, add new entry at correct position |
| **Modify** | `lib/route-meta.ts` — add vendor-specialist entry |
| **Create** | `prisma/migrations/20260517_add_vendor_specialist_permissions/migration.sql` |
| **Modify** | `AGENTS.md` — add vendor-specialist to permissions table |

---

## Out of Scope (Phase 2 — nanti)

- Hapus Set Vendor, Catering, Decoration dari Booking feature
- Perubahan schema Prisma
- Submenu (Pemeliharaan Venue, Evaluasi Vendor, dll) — placeholder untuk future
