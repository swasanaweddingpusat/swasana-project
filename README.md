# Swasana Wedding Management System

Sistem manajemen wedding venue berbasis web. Dibangun dengan Next.js 16, Prisma 7, dan Neon PostgreSQL.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.3 (App Router, Turbopack) |
| Database | PostgreSQL (Neon serverless, WebSocket adapter) |
| ORM | Prisma 7.7.0 |
| Auth | NextAuth v5 (JWT strategy) |
| UI | Shadcn v4 + Tailwind v4 |
| Forms | react-hook-form + Zod v4 |
| Data Fetching | TanStack Query v5 |
| Email | Resend |
| Storage | Cloudflare R2 |

## Prerequisites

- Node.js ≥ 20.9.0
- npm (atau pnpm/yarn)
- Akun [Neon](https://neon.tech) untuk PostgreSQL database
- Akun [Resend](https://resend.com) untuk email (opsional untuk development)

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd swasana-project
npm install
```

### 2. Environment Variables

Copy `.env.example` ke `.env` dan isi semua value:

```bash
cp .env.example .env
```

Variable yang wajib diisi:

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string Neon PostgreSQL |
| `DIRECT_URL` | Direct connection (tanpa pooler) untuk migration |
| `AUTH_SECRET` | Generate dengan `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` untuk development |

### 3. Database Setup

#### Generate Prisma Client

```bash
npm run db:generate
```

#### Push Schema ke Database (development)

Untuk development, gunakan `db:push` yang langsung sync schema tanpa migration files:

```bash
npm run db:push
```

#### Jalankan Seeder

Seed database dengan data awal (roles, permissions, brands, venues, admin user):

```bash
npm run db:seed
```

Admin default: `admin@swasana.com` / `Admin@1234`

### 4. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Database Commands

| Command | Keterangan |
|---|---|
| `npm run db:generate` | Generate Prisma Client dari schema |
| `npm run db:push` | Push schema ke database (development, tanpa migration) |
| `npm run db:migrate` | Buat migration baru (development) |
| `npm run db:migrate:deploy` | Deploy migration ke production |
| `npm run db:seed` | Jalankan seeder (truncate + seed ulang) |
| `npm run db:studio` | Buka Prisma Studio (GUI database) |
| `npm run db:reset` | Reset database + jalankan semua migration + seed |

## Migration Workflow

### Development (schema baru / perubahan schema)

1. Edit `prisma/schema.prisma`
2. Buat migration:
   ```bash
   npm run db:migrate
   ```
   Prisma akan minta nama migration, contoh: `add_booking_table`
3. Migration file otomatis dibuat di `prisma/migrations/`
4. Prisma Client otomatis di-regenerate

### Production Deployment

```bash
npm run db:migrate:deploy
```

Ini menjalankan semua migration yang belum di-apply tanpa prompt interaktif.

### Quick Sync (development only)

Kalau cuma mau sync schema tanpa bikin migration file:

```bash
npm run db:push
```

> ⚠️ Jangan pakai `db:push` di production — gunakan `db:migrate:deploy`.

### Reset Database (development only)

Reset semua data dan jalankan ulang migration + seed:

```bash
npm run db:reset
```

> ⚠️ Ini akan menghapus SEMUA data di database.

## Seeder

Seeder (`prisma/seed.ts`) membuat data awal:

- **9 Roles**: Super Admin, Direktur Sales, Manager, dll.
- **107 Permissions**: Granular per module (booking, hr, finance, dll.)
- **3 Brands**: Swasana, Gunawarman, Pakubuwono
- **10 Venues**: BRIN Thamrin, Seskoad, Menara Bripens, dll.
- **1 Admin User**: `admin@swasana.com` / `Admin@1234` (semua venue, semua permission)

Seeder bersifat **destructive** — truncate semua data sebelum seed ulang.

## Project Structure

```
swasana-project/
├── actions/              # Server actions ("use server")
├── app/
│   ├── (public)/auth/    # Login, forgot-password, reset-password, verify
│   ├── (private)/        # Protected routes (AuthGate)
│   │   └── dashboard/    # Main app
│   └── api/              # API routes
├── components/
│   ├── ui/               # Shadcn (jangan edit manual)
│   ├── providers/        # QueryClient, Theme, Session
│   └── shared/           # Reusable cross-feature
├── emails/               # Email templates (Resend)
├── hooks/                # Client hooks (use-*.ts)
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── db.ts             # Prisma client (Neon WebSocket)
│   ├── permissions.ts    # RBAC helpers
│   ├── queries/          # Server-side read helpers
│   └── validations/      # Zod schemas
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── seed.ts           # Database seeder
│   └── migrations/       # Migration files
├── services/             # Domain logic
├── types/                # TypeScript types
└── proxy.ts              # Route protection (Next.js 16)
```

## Auth Flow

1. **`proxy.ts`** — Edge-level route guard, cek cookie existence (no DB)
2. **`AuthGate`** — Server Component, cek session validity (status, verified, dll.)
3. **JWT callback** — Refresh profile dari DB setiap 10 menit
4. **`requirePermission()`** — RBAC check di setiap server action/API route

## Scripts

| Command | Keterangan |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
