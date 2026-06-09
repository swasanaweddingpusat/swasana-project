# Pengadaan Barang — Design Spec

**Date:** 2026-06-09  
**Branch:** seeddatacalandar  
**Approach:** B — Integrated (Neon/Prisma, R2, existing Venue & Profile)  
**Reference app:** `D:\App\pengadaan-barang-update-fix1` (standalone React + Supabase)

---

## 1. Overview

Modul Pengadaan Barang adalah fitur manajemen pengajuan pembelian barang untuk internal SGP Group. Diimplementasikan ke dalam sistem Swasana (Next.js 16 + Neon/Prisma) menggunakan pola dan konvensi yang sudah ada di project — bukan standalone app.

**Fitur yang diimplementasikan:**
- CRUD item pengadaan + upload bukti pembelian (R2)
- Approval workflow: `PENDING → APPROVED / REJECTED → COMPLETED`
- Filter, summary/laporan per venue / divisi / status
- Pengumuman dari admin ke user procurement
- Export CSV dan Excel

---

## 2. Database Schema

### 2.1 Enums baru

```prisma
enum ProcurementStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
}

enum ProcurementDivision {
  HR
  OPERATIONAL
  IT
  FINANCE
  MICE
}

enum ProcurementEventType {
  WEDDING
  NON_WEDDING
}

enum ProcurementAnnouncementTarget {
  ALL
  VENUE
  DIVISION
}
```

### 2.2 Model `ProcurementItem`

```prisma
model ProcurementItem {
  id                 String               @id @default(uuid())
  tanggalPermintaan  DateTime
  venueId            String
  namaBarang         String
  jumlahBarang       Int
  sisaBarang         Int
  penggunaan         String?
  picPenerima        String
  linkBarang         String?
  note               String?
  keterangan         String?              // alasan tolak, catatan status
  keteranganAcara    ProcurementEventType
  weddingNote        String?
  nonWeddingNote     String?
  totalWedding       Decimal?
  totalNonWedding    Decimal?
  total              Decimal?
  status             ProcurementStatus    @default(PENDING)
  division           ProcurementDivision
  buktiBelUrl        String?              // R2 URL bukti pembelian
  createdById        String
  approvedById       String?
  approvedAt         DateTime?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  venue      Venue   @relation(fields: [venueId], references: [id], onDelete: Restrict)
  createdBy  Profile @relation("ProcurementCreator", fields: [createdById], references: [id], onDelete: Restrict)
  approvedBy Profile? @relation("ProcurementApprover", fields: [approvedById], references: [id], onDelete: SetNull)

  @@index([venueId])
  @@index([status])
  @@index([division])
  @@index([createdById])
  @@index([approvedById])
  @@index([tanggalPermintaan])
  @@map("procurement_items")
}
```

### 2.3 Model `ProcurementAnnouncement`

```prisma
model ProcurementAnnouncement {
  id             String                        @id @default(uuid())
  title          String
  content        String
  isActive       Boolean                       @default(true)
  targetAudience ProcurementAnnouncementTarget @default(ALL)
  targetList     String[]
  createdById    String
  createdAt      DateTime                      @default(now())
  updatedAt      DateTime                      @updatedAt

  createdBy Profile @relation("ProcurementAnnouncementCreator", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([isActive])
  @@index([createdById])
  @@map("procurement_announcements")
}
```

### 2.4 Relasi baru di model yang ada

- `Venue` tambah: `procurementItems ProcurementItem[]`
- `Profile` tambah:
  - `procurementItemsCreated ProcurementItem[] @relation("ProcurementCreator")`
  - `procurementItemsApproved ProcurementItem[] @relation("ProcurementApprover")`
  - `procurementAnnouncements ProcurementAnnouncement[] @relation("ProcurementAnnouncementCreator")`

---

## 3. Permission System

### 3.1 Modul baru di permission matrix

| Module | Action | Keterangan |
|---|---|---|
| `procurement` | `view` | Lihat daftar & detail item |
| `procurement` | `create` | Submit pengajuan baru |
| `procurement` | `edit` | Edit item (milik sendiri atau semua, tergantung dataScope) |
| `procurement` | `delete` | Hapus item |
| `procurement` | `approve` | Ubah status: Approve / Tolak / Selesai |

### 3.2 Role baru

**`Procurement Manager`** — role non-system, dibuat via seeder:
- Permissions: `procurement:view`, `create`, `edit`, `delete`, `approve`

Staff biasa dapat `procurement:view` dan `procurement:create` via assignment manual di settings.

### 3.3 Seeder

Tambahkan ke `prisma/seeders/roles-permissions.ts`:
```ts
{ module: "procurement", actions: ["view", "create", "edit", "delete", "approve"] }
```

Dan tambah role `Procurement Manager` ke `rolePermissionMap`.

---

## 4. Page Structure & Routing

```
app/(private)/dashboard/pengadaan-barang/
├── page.tsx                          ← Main: stats + filter + tabel
└── _components/
    ├── ProcurementFilters.tsx         ← Filter: venue, divisi, status, tanggal range
    ├── ProcurementTable.tsx           ← Tabel data + pagination
    ├── ProcurementStats.tsx           ← Kartu ringkasan per status
    ├── AddProcurementDrawer.tsx       ← Form tambah item
    ├── EditProcurementDrawer.tsx      ← Form edit item
    ├── ViewProcurementModal.tsx       ← Detail item (read-only)
    ├── ApprovalModal.tsx              ← Approve/Tolak/Selesai + keterangan
    └── BulkEditModal.tsx              ← Edit status beberapa item sekaligus

app/(private)/dashboard/pengadaan-barang/pengumuman/
├── page.tsx
└── _components/
    ├── AnnouncementTable.tsx
    └── AnnouncementFormDrawer.tsx
```

**Sidebar** — update `sidebar-config.ts`:
- Unhide entry `pengadaan-barang` yang sudah ada
- Tambah child item `Pengumuman` → `/dashboard/pengadaan-barang/pengumuman`
- Permission gate: `procurement:view`

---

## 5. API Routes

```
app/api/procurement/
├── route.ts                     GET  list (filter + pagination)
│                                POST create
├── [id]/
│   ├── route.ts                GET  detail
│   │                           PATCH edit
│   │                           DELETE hapus
│   └── approve/route.ts        PATCH approve / reject / complete
├── announcements/
│   ├── route.ts                GET  list
│   │                           POST create
│   └── [id]/route.ts          PATCH edit
│                               DELETE hapus
├── summary/route.ts            GET  stats per status/venue/divisi
└── export/route.ts             GET  export (format=csv|excel)
```

**Semua endpoint wajib:**
- Rate limiter: `apiLimiter` untuk GET, `mutationLimiter` untuk POST/PATCH/DELETE
- `requirePermissionForRoute({ module: "procurement", action: "..." })`
- Zod validation pada body
- `logAudit()` untuk setiap mutasi
- `revalidateTag("procurement", "max")` setelah mutasi

**Upload bukti pembelian:**
Reuse endpoint `/api/maintenance/upload` yang sudah ada — endpoint ini sudah menerima `folder` query param. Panggil dengan `?folder=procurement`. File disimpan di R2 folder `procurement/`. URL hasil upload disimpan ke `buktiBelUrl`.

---

## 6. Business Logic

### 6.1 Status Transitions

```
PENDING ──→ APPROVED   (procurement:approve) 
PENDING ──→ REJECTED   (procurement:approve + keterangan wajib diisi)
APPROVED ──→ COMPLETED (procurement:approve)
```

Transisi lain tidak diizinkan (validasi di API).

### 6.2 Notifications

- Saat item submit (`PENDING`): notifikasi ke semua Profile yang punya `procurement:approve`
- Saat status berubah: notifikasi ke `createdById` item tersebut

Pakai `Notification` model yang sudah ada.

### 6.3 Export

- Endpoint `GET /api/procurement/export?format=csv|excel`
- Query params filter (venue, divisi, status, tanggal) ikut diteruskan
- Field yang diekspor: tanggal, venue, nama barang, qty, sisa, PIC, total, status, divisi, keterangan

### 6.4 Pengumuman

- Tampil sebagai banner/alert card di bagian atas halaman utama pengadaan
- Filter `isActive = true` dan target sesuai venue/divisi user yang login
- Hanya user dengan `procurement:create` atau `procurement:edit` bisa manage pengumuman

---

## 7. Lib & Services

```
lib/validations/procurement.ts      ← Zod schemas (createSchema, updateSchema, approveSchema, announcementSchema)
lib/queries/procurement.ts          ← Server-side read helpers
services/procurementService.ts      ← Client-side fetch helpers (TanStack Query)
hooks/useProcurement.ts             ← useQuery / useMutation wrappers
```

---

## 8. Checklist Before Done

- [ ] Prisma migration generated & committed
- [ ] `npx prisma validate` passes
- [ ] Permission seeder updated + role Procurement Manager dibuat
- [ ] Sidebar entry di-unhide + child Pengumuman ditambah
- [ ] Semua API endpoint: rate limiter + permission + zod + audit + revalidate
- [ ] Upload bukti pembelian bekerja via R2
- [ ] Export CSV dan Excel berfungsi
- [ ] Approval modal: keterangan wajib saat REJECTED
- [ ] Notifikasi dikirim saat submit dan saat status berubah
- [ ] TypeScript build passes (no `any`, no unused imports)
