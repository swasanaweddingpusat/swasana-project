# Architecture & Steering — swasana-project

> **Baca ini dulu sebelum ngoding.** Dokumen ini kasih peta mental: apa project ini,
> gimana bentuknya, dan di mana naruh kode. Aturan coding detail (auth hardening,
> rate limit, transaction, design system, naming) ada di **AGENTS.md** — itu sumber
> kebenaran untuk *cara nulis kode*. File ini sumber kebenaran untuk *di mana & kenapa*.

---

## 1. Apa ini

**swasana-project = internal operations app untuk Swasana (wedding & MICE venue / event organizer).**

Ini **BUKAN** app untuk client/tamu. Ini tools internal yang dipakai karyawan:
sales, manager, finance, operasional, HRD, super-admin. Satu-satunya area publik =
`/client-agreement` (client buka link buat tanda tangan PO) + beberapa form publik
(`recruitment-form`, `wedding-indicator`).

Alur bisnis inti (sales pipeline end-to-end):

```
Leads / Daily Activity  →  Quotation  →  Deal (jadi Customer + Booking draft)
        →  Booking (Weddings / MICE): draft → finalize → snapshot → approval
        →  Client tanda tangan PO  →  Confirmed  →  Finance AR (termin, ack, piutang)
```

Modul pendukung: HRD (payroll, absensi, cuti, rekrutmen), Purchase (vendor-specialist + PO),
Procurement (pengadaan), Vendor (master vendor, general), Groups (tim sales + target vs achievement),
Bitrix24 (CRM sync), Maintenance, Guestbook.

---

## 2. Stack (ringkas — detail di AGENTS.md §1)

| Layer | Tech | Catatan penting |
|---|---|---|
| Framework | **Next.js 16.2.3** | App Router, Turbopack. **`proxy.ts` BUKAN `middleware.ts`**. `cookies()`/`headers()` async. Baca `node_modules/next/dist/docs/` sebelum pakai API Next apa pun. |
| UI | React 19.2.4 | Server Components default |
| DB | PostgreSQL | Neon (`@prisma/adapter-neon`) default; `DB_NEON=false` → native `@prisma/adapter-pg`. `$transaction([...])` **array form only**, no callback, no `createMany` |
| ORM | Prisma 7 | ~130 model, ~181 migration |
| Auth | NextAuth v5 beta | JWT strategy, PrismaAdapter, hardened (rate limit + lockout + audit) |
| UI kit | shadcn v4 (base-nova) + Tailwind v4 | `components/ui/*` generated — **jangan edit** |
| Icons | `@solar-icons/react` | `weight="BoldDuotone"` |
| Forms | react-hook-form + Zod v4 | schema di `lib/validations/` |
| Client data | TanStack Query v5 | hooks di `hooks/` |
| Email | Resend | template di `emails/` |
| Storage | MinIO / S3-compatible (S3 SDK) | `lib/storage.ts`, `forcePathStyle: true` |
| E-meterai | Peruri | `PERURI_*` env |
| CRM sync | Bitrix24 | inbound webhook (`BITRIX_WEBHOOK_BASE`), route `/bitrix24/*` + `/api/bitrix/*` |

---

## 3. Peta folder (yang wajib dipahami)

```
app/
├── (public)/                 # Tanpa auth: auth pages, client-agreement, form publik
├── (private)/                # Butuh session (AuthGate). Semua app internal di sini.
│   ├── layout.tsx            # <AuthGate> — cek status/verified/mustChangePassword
│   ├── _components/sidebar/  # Shell: sidebar, module-switcher, nav (lihat §5)
│   ├── select-module/        # Picker "world" saat login (auto-redirect kalau cuma 1)
│   ├── (general)/            # ★ MENU GENERAL — lintas-world (lihat §5)
│   │   ├── vendor/  procurement/  bitrix24/  maintenance/  guestbook/  cuti/
│   │   ├── slip-gaji/  settings/  profile/  notifications/  tutorial/  wedding-indicators/
│   ├── finance/              # World: Finance
│   ├── hrd/                  # World: HRD
│   ├── booking/              # World: Booking (weddings, mice, groups, quotations, dst)
│   └── purchase/             # World: Purchase (vendor-specialist → purchase-order)
├── api/<resource>/route.ts   # REST handlers (GET reads + non-action mutations)
components/
├── ui/                       # shadcn generated — JANGAN edit
├── providers/                # QueryClient, Theme, Session, drawer providers
└── shared/                   # Reusable lintas-fitur (PermissionGate, Drawer, dll)
actions/                      # "use server" — 1 file per domain (writes)
lib/
├── queries/                  # Server-side reads (SELECT) — 1 file per domain
├── validations/              # Zod schemas — 1 file per domain
├── auth.ts db.ts permissions.ts rate-limit.ts audit.ts storage.ts route-meta.ts …
hooks/  services/  emails/  types/  prisma/  proxy.ts
```

**Aturan penempatan (non-negotiable):**
- Reads (SELECT) → `lib/queries/`. Writes (INSERT/UPDATE/DELETE) → `actions/` atau `app/api/`.
- Server actions → `actions/` (`"use server"`). API routes → `app/api/`. Jangan campur / duplikat.
- Feature component co-located di `<feature>/_components/`. Naik ke `components/shared/` cuma kalau dipakai ≥2 fitur.
- `components/ui/` shadcn generated — wrap di `components/shared/`, jangan hand-edit.
- Email template → `emails/`.

---

## 4. Konsep arsitektur inti (paham ini = paham project)

### 4.1 Snapshot pattern (booking)
Saat booking **finalize**, seluruh data (customer/venue/package/harga) di-**freeze** ke tabel
`snap*`. PDF, kontrak, dan client agreement render dari **snapshot**, bukan master live.
Material change setelah finalize → reset approval. Ini yang bikin dokumen legal tetap
konsisten walau master data berubah kemudian.

### 4.2 DB-driven approval
Approval flow per module disimpan di DB (`ApprovalFlowConfig`) — bukan hardcode.
Tiap entity punya record + step, di-snapshot per `revisionId`. Bisa dikonfigurasi lewat Settings.

### 4.3 DB-backed progressive draft
Booking pakai draft di DB (`recordStatus: draft/saved`), **bukan** browser storage.
Query listing selalu exclude draft. Multi-step form nyimpen progres ke DB tiap step.

### 4.4 dataScope access control
`Profile.dataScope` (`own` / `group` / `all`) nentuin user bisa lihat booking siapa.
Enforce lewat `lib/access-control.ts` (`canAccessBooking`, `getProfileDataScope`).

### 4.5 Permission model
`Role` (punya flag boolean **`isSystemRole`** untuk super-admin — BUKAN string match) →
`RolePermission` → `Permission` (`@@unique([module, action])`). Gate:
- Server action: `requirePermission({module,action})` → `{session, error}` (selalu destructure).
- Route handler: `requirePermissionForRoute(...)` → `{session, response}`.
- Page: `requirePagePermission(module)`.
- Client: `usePermissions().can(module,action)` / `<PermissionGate>`.

Daftar `(module, action)` authoritative ada di **AGENTS.md §5**.

---

## 5. Sidebar: "World" vs "General" (SERING SALAH PAHAM)

Sidebar punya dua kelas menu. Salah taruh = menu muncul di tempat salah.

**World menu** — modul besar yang muncul di **module-switcher** (dropdown pemilih dunia).
Ada 4: `finance`, `hrd`, `booking`, `purchase`. Didefinisikan di
`MODULE_NAV_MAP` (sidebar-config.ts) + tabel DB `modules` / `module_permission_maps`.
Sebuah world muncul di switcher untuk suatu role kalau role itu punya `view` pada
**salah satu** permission-module yang di-map ke world tsb (lihat `getAccessibleModules()`
di `lib/queries/modules.ts`).

**General menu** — item lintas-world yang muncul **flat** di setiap dunia
(mis. Vendor, Procurement, Bitrix24, Maintenance, Guestbook, Pengajuan Cuti, Slip Gaji).
Didefinisikan di `GENERAL_NAV` (sidebar-config.ts). Route-nya hidup di `app/(private)/(general)/`.

### Aturan penentu world vs general
> Permission-module yang **di-map** di `module_permission_maps` → muncul sebagai **world**.
> Permission-module yang **TIDAK di-map** ke world mana pun → **general**.

**Registry authoritative = `prisma/seeders/modules.ts`** (`MODULE_REGISTRY`).
Ini seeder idempotent + reconciling: upsert module, tambah mapping kurang, **hapus mapping
yang gak terdaftar**. Untuk mindahin fitur antara world ↔ general, **edit `MODULE_REGISTRY`
saja** lalu `npm run db:seed:modules`:
- world → tambahkan permission-module-nya di bawah `permissions` module target.
- general → hapus dari semua `permissions` (biarkan unmapped), lalu daftarkan di `GENERAL_NAV`.

Contoh nyata: `procurement`, `customers` (Bitrix24), dan `vendor` sengaja **tidak** di-map → general.

Route-meta (header + breadcrumb) **auto-derive** dari `MODULE_NAV_MAP` + `GENERAL_NAV`
(`lib/route-meta.ts` `buildRouteMetaFromNavTrees()`) — pindahin nav entry, header ikut update.
File sidebar terkait: `_components/sidebar/{sidebar-config.ts, module-switcher.tsx,
sidebar-nav.tsx, use-active-module.ts}`.

---

## 6. Alur mutation standar (hafal urutannya)

**Server action:**
```
requirePermission → mutationLimiter.check → Zod safeParse
  → db.$transaction([...]) → logAudit → revalidateTag(tag,"max") → return {success, data?|error}
```

**Route handler:**
```
requirePermissionForRoute → apiLimiter/mutationLimiter → Zod → db.$transaction([...])
  → logAudit → revalidateTag → Response.json
```

Detail hardening (timing-safe compare, lockout, token `usedAt`, session invalidation
setelah ganti password, dsb) → **AGENTS.md §4**.

---

## 7. Konvensi cepat

- **Hooks** (`hooks/useXxx.ts`): fetch fn + `useXxx` (useQuery, queryKey flat array) +
  `useCreate/Update/Delete` (useMutation → server action, invalidate onSuccess).
- **Services** (`services/xxxService.ts`): fetch wrapper ke REST, throw on error.
- **Migration**: tiap perubahan `schema.prisma` WAJIB migration file, idempotent
  (`IF NOT EXISTS`), commit bareng. Reference data → INSERT `ON CONFLICT DO NOTHING`
  di migration. Dev-only data (test user, sample) → `prisma/seeders/`. Detail AGENTS.md §6.
- **Seeder**: idempotent, run-guard `if (process.argv[1]?.includes("<name>"))`,
  `import { prisma } from "./_client"`, jalanin `npx tsx` / `npm run db:seed:<x>`.
- **Design system**: monochrome chrome + brand ink/gold/cream (Bank Jago vibe).
  Cuma pakai token (`primary`, `muted`, `destructive`, dll) — **no hardcode hex/warna**.
  Detail AGENTS.md §12.

---

## 8. Kalau bingung

- API Next.js 16 → `node_modules/next/dist/docs/01-app/`.
- Schema / field → `prisma/schema.prisma`.
- Aturan coding (auth, rate limit, transaction, naming, design, ESLint) → **AGENTS.md**.
- Peta implementasi lebih dalam (fungsi mana di file mana) → memory `reference-codebase-map`.
- Build gagal → baca error, trace ke source. Pendekatan sama gagal 2×? Stop, diagnosa root cause.
