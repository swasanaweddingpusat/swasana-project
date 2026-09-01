# Swasana — Internal Operations App

Aplikasi operasional internal untuk **Swasana** (wedding & MICE venue / event organizer).
Dipakai karyawan internal — sales, manager, finance, operasional, HRD, dan super-admin.
Ini **bukan** aplikasi untuk client/tamu.

Dibangun dengan Next.js 16 (App Router), Prisma 7, PostgreSQL, dan TanStack Query.

---

## Tech Stack

| Layer | Tech | Catatan |
|---|---|---|
| Framework | Next.js **16.2.3** | App Router, Turbopack, `proxy.ts` (BUKAN `middleware.ts`) |
| UI | React **19.2.4** | Server Components default |
| Runtime | Node.js **≥ 20.9.0** | Node 18 sudah tidak didukung |
| Language | TypeScript | strict mode |
| Database | PostgreSQL | Neon (`@prisma/adapter-neon`) default; `DB_NEON=false` → native `@prisma/adapter-pg` |
| ORM | Prisma **7.8.0** | `prisma-client-js` generator |
| Auth | NextAuth (Auth.js) **v5 beta** | JWT strategy + PrismaAdapter |
| UI kit | shadcn v4 (base-nova) + Tailwind v4 | `components/ui/*` generated, jangan edit manual |
| Icons | `@solar-icons/react` | `weight="BoldDuotone"` |
| Forms | react-hook-form + Zod v4 | schema di `lib/validations/` |
| Data fetching | TanStack Query v5 | hooks di `hooks/` |
| Email | Resend | template di `emails/` |
| Storage | MinIO / S3-compatible | `lib/storage.ts` (S3 SDK) |
| E-meterai | Peruri | `PERURI_*` env |
| CRM sync | Bitrix24 | inbound webhook, route `/bitrix24/*` + `/api/bitrix/*` |

> Untuk peta arsitektur & aturan coding lengkap, baca `ARCHITECTURE.md` dan `AGENTS.md`.

---

## Prerequisites

- Node.js ≥ 20.9.0
- npm
- PostgreSQL (Neon untuk development, atau self-hosted PostgreSQL/Dokploy)

---

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd swasana-project
npm install
```

`postinstall` otomatis menjalankan `prisma generate`.

### 2. Environment Variables

Copy `.env.example` ke `.env` lalu isi nilainya:

```bash
cp .env.example .env
```

Variable inti:

| Variable | Keterangan |
|---|---|
| `DB_NEON` | `true` → Neon adapter; `false` → native PostgreSQL |
| `DATABASE_URL` | Pooled connection (runtime app) |
| `DIRECT_URL` | Direct connection (Prisma CLI / migrations) |
| `AUTH_SECRET` | Generate dengan `openssl rand -base64 32` |
| `AUTH_URL` | Public base URL (mis. `http://localhost:3200` untuk dev) |
| `AUTH_TRUST_HOST` | `true` jika di belakang reverse proxy (Dokploy/Traefik) |

Daftar env lengkap (Resend, S3/MinIO, Peruri, Bitrix24, VAPID) ada di `.env.example`.

### 3. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Terapkan migration (development)
npm run db:migrate

# Terapkan migration (production / staging, non-interaktif)
npm run db:migrate:deploy
```

> ⚠️ Jangan pakai `db:push` di branch yang akan di-merge. Selalu pakai migration.

### 4. Jalankan Seeder

Seeder reference data (roles, permissions, module registry, brands, venues, dst):

```bash
npm run db:seed
```

Seeder per-domain juga tersedia, misalnya:

```bash
npm run db:seed:roles-permissions
npm run db:seed:modules
npm run db:seed:brands-venues
npm run db:seed:packages
npm run db:seed:bookings-2026
```

### 5. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3200](http://localhost:3200).

---

## Database Commands

| Command | Keterangan |
|---|---|
| `npm run db:generate` | Generate Prisma Client dari schema |
| `npm run db:migrate` | Buat & terapkan migration baru (development) |
| `npm run db:migrate:deploy` | Terapkan migration yang belum di-apply (non-interaktif) |
| `npm run db:push` | Sync schema tanpa migration file (development only) |
| `npm run db:seed` | Jalankan seeder utama |
| `npm run db:studio` | Buka Prisma Studio (GUI) |
| `npm run db:reset` | Reset DB + jalankan semua migration + seed |

---

## Migration Workflow

Setiap perubahan di `prisma/schema.prisma` **wajib** punya migration file.

1. Edit `prisma/schema.prisma`
2. Buat migration:
   ```bash
   npm run db:migrate -- --name <nama_deskriptif>
   ```
3. Migration harus idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
4. Commit file migration bersama perubahan schema
5. Verifikasi:
   ```bash
   npx prisma validate
   ```

Reference data yang dibutuhkan semua environment (roles, permissions, module registry)
di-insert langsung via migration SQL. Seeder hanya untuk data dev-only / yang butuh runtime logic.

---

## Project Structure

```
swasana-project/
├── actions/                  # "use server" — satu file per domain
├── app/
│   ├── (public)/             # Tanpa auth: login, client-agreement, form publik
│   ├── (private)/            # Butuh session (AuthGate)
│   │   ├── _components/      # shell: sidebar, header, auth-gate, mobile-bottom-nav
│   │   ├── page.tsx          # Overview general (landing "/") — lintas-world, no picker
│   │   ├── (general)/        # menu lintas-world (vendor, procurement, bitrix24, …)
│   │   ├── finance/          # world: Finance
│   │   ├── hrd/              # world: HRD
│   │   ├── booking/          # world: Booking
│   │   └── purchase/         # world: Purchase
│   └── api/                  # REST route handlers
├── components/
│   ├── ui/                   # shadcn generated — jangan edit manual
│   ├── providers/            # QueryClient, Theme, Session, drawer providers
│   └── shared/               # reusable lintas-fitur
├── emails/                   # template Resend
├── hooks/                    # TanStack Query wrappers — useXxx.ts
├── lib/
│   ├── auth.ts               # konfigurasi NextAuth
│   ├── db.ts                 # Prisma singleton
│   ├── audit.ts              # logAudit()
│   ├── permissions.ts        # requirePermission / hasPermission
│   ├── rate-limit.ts         # in-memory rate limiter
│   ├── queries/              # server-side reads (SELECT)
│   ├── validations/          # Zod schema per domain
│   ├── route-meta.ts         # URL → title/subtitle/parent
│   └── storage.ts            # S3/MinIO
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seeders/
├── services/                 # client-side fetch helpers
├── types/                    # ambient + shared types
├── proxy.ts                  # route protection (BUKAN middleware.ts)
└── next.config.ts
```

**Aturan penempatan inti:**
- Reads (SELECT) → `lib/queries/`
- Writes (INSERT/UPDATE/DELETE) → `actions/` atau `app/api/`
- Feature component → `<feature>/_components/`, naik ke `components/shared/` hanya jika dipakai ≥2 fitur
- `components/ui/` shadcn-generated — jangan hand-edit

---

## Auth Flow

1. **`proxy.ts`** — route guard edge-safe, cek cookie session (tanpa DB)
2. **`AuthGate`** — cek session content (status, `isEmailVerified`, `mustChangePassword`)
3. **JWT callback** — refresh profil dari DB setiap 10 menit
4. **`requirePermission()` / `requirePermissionForRoute()`** — RBAC di setiap mutation
5. **Rate limiting** — `authLimiter` / `mutationLimiter` / `apiLimiter` di semua handler

---

## Scripts

| Command | Keterangan |
|---|---|
| `npm run dev` | Development server (Turbopack, port 3200) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest watch mode |

---

## Dokumentasi Lanjutan

- **`ARCHITECTURE.md`** — peta arsitektur & steering (di mana naruh kode, world vs general sidebar, snapshot/approval/draft pattern, alur mutation).
- **`AGENTS.md`** — aturan coding (auth hardening, rate limit, transaction, naming, design system, ESLint, migration).
- **`INFRASTRUCTURE.md`** — rencana infrastruktur produksi (VPS + PostgreSQL + storage).
