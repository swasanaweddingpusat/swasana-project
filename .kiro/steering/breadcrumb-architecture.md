---
inclusion: manual
---

# Breadcrumb & Page Header Architecture — swasana-project

## Keputusan: Layout-Level Breadcrumb di Dashboard Header

### Kenapa Layout (Header), Bukan Per-Page?

**Analisis impact:**

| Aspek | Layout (Header) | Per-Page |
|---|---|---|
| Jumlah file yang diubah | 1 (Header component) | 9+ settings pages + profile + future pages |
| Konsistensi | Otomatis konsisten | Rawan lupa di page baru |
| Maintenance | Satu tempat | Harus ingat tambah di setiap page baru |
| Fleksibilitas | Cukup fleksibel — kalau pathname gak ada di `ROUTE_META`, breadcrumb gak muncul | Sangat fleksibel tapi overkill |
| Performance | `usePathname()` sudah di-cache Next.js, lookup O(n) di `ROUTE_META` sangat ringan | Sama ringannya, tapi duplikasi logic |
| Impact ke page lain | Zero — page yang gak terdaftar di `ROUTE_META` gak kena efek | Zero |

**Kesimpulan:** Layout-level menang di semua aspek kecuali "fleksibilitas per-page" yang sebenarnya gak dibutuhkan di project ini. Semua settings sub-page punya pola breadcrumb yang sama: `Settings > [Page Name]`.

### Arsitektur yang Dipilih

```
Dashboard Layout (layout.tsx)
└── Header (header.tsx) ← breadcrumb + page title + subtitle ditaruh di sini
    ├── Left: Breadcrumb + Title + Subtitle (dari ROUTE_META)
    └── Right: UserMenu (existing)
```

**Bukan** di settings layout, karena:
- Breadcrumb juga dibutuhkan di halaman non-settings (profile, bookings, dll) di masa depan
- Kalau taruh di settings layout, nanti harus duplikasi lagi di layout lain
- Dashboard Header adalah satu-satunya tempat yang konsisten di semua halaman

### Infrastruktur yang Sudah Ada

1. **`lib/route-meta.ts`** — sudah lengkap:
   - `ROUTE_META` object dengan title, subtitle, parent chain
   - `getBreadcrumbs()` function yang traverse parent chain
   - Belum dipakai di mana-mana (zero import)

2. **`components/shared/page-header.tsx`** — ada tapi:
   - Gak ada breadcrumb support
   - Gak dipakai di swasana-project (hanya di contoh project)
   - **Keputusan:** Gak perlu pakai component ini. Breadcrumb + title langsung di Header.

3. **Settings sub-pages** — semuanya bare (gak ada header/title):
   - `users/page.tsx` → langsung render `UsersTable`
   - `roles/page.tsx` → langsung render `RolesManager`
   - `venues/page.tsx` → render `ComingSoon`
   - Ini bagus — page tetap clean, header handle display info

### Aturan Implementasi

#### 1. Header Component (`_components/header/header.tsx`)

- Tambahkan `"use client"` (sudah ada)
- Pakai `usePathname()` dari `next/navigation`
- Panggil `getBreadcrumbs(pathname)` dan `ROUTE_META[pathname]`
- Render breadcrumb di sisi kiri, UserMenu tetap di sisi kanan
- Kalau `ROUTE_META[pathname]` gak ada → header tetap muncul tapi tanpa breadcrumb/title (fallback graceful)

#### 2. Breadcrumb UI

- **Jangan** install shadcn breadcrumb component — terlalu heavy untuk kebutuhan ini
- Buat inline di Header atau buat component kecil `_components/header/breadcrumbs.tsx`
- Pakai `<nav aria-label="Breadcrumb">` untuk accessibility
- Separator: `ChevronRight` dari lucide-react (konsisten dengan contoh project)
- Link pakai `next/link` untuk semua crumb kecuali yang terakhir (current page)

#### 3. Page Title & Subtitle

- Title dan subtitle diambil dari `ROUTE_META[pathname]`
- Ditampilkan di bawah breadcrumb di Header
- Ini menggantikan kebutuhan `PageHeader` component di setiap page

#### 4. Menambah Route Baru

Kalau bikin page baru, cukup tambah entry di `ROUTE_META`:

```ts
// lib/route-meta.ts
"/dashboard/bookings": {
  title: "Bookings",
  subtitle: "Kelola semua booking",
  parent: "/dashboard",  // optional, untuk breadcrumb chain
},
```

Gak perlu edit Header, gak perlu edit page. Otomatis muncul.

#### 5. Halaman Tanpa Breadcrumb

Halaman yang gak terdaftar di `ROUTE_META` (misalnya `/dashboard` sendiri) → Header tetap render tapi bagian breadcrumb/title kosong. Ini by design, bukan bug.

### Yang TIDAK Boleh Dilakukan

- ❌ Taruh breadcrumb di `settings/layout.tsx` — nanti harus duplikasi di layout lain
- ❌ Taruh breadcrumb di setiap `page.tsx` — maintenance nightmare
- ❌ Pakai `PageHeader` component di setiap page — redundan kalau Header sudah handle
- ❌ Install shadcn breadcrumb — overkill, bikin sendiri lebih ringan
- ❌ Hardcode breadcrumb text — selalu ambil dari `ROUTE_META`
- ❌ Bikin breadcrumb component yang query DB — breadcrumb murni static dari config

### Checklist Sebelum Implementasi

- [ ] Pastikan `ROUTE_META` sudah cover semua route yang butuh breadcrumb
- [ ] Header component pakai `usePathname()` — ini client component, sudah `"use client"`
- [ ] Breadcrumb accessible: `<nav aria-label="Breadcrumb">`, proper link semantics
- [ ] Test: navigasi ke route yang gak ada di `ROUTE_META` → header gak error
- [ ] Test: navigasi ke settings sub-page → breadcrumb muncul "Settings > Users"
- [ ] Test: klik breadcrumb link → navigasi ke parent route
