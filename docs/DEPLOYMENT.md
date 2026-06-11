# Deployment — Dokploy (VPS)

Project ini deploy ke **Dokploy** (self-hosted di VPS), bukan Vercel. Build
dilakukan oleh Dokploy dari `Dockerfile` (multi-stage, Next.js 16 standalone).
Migration dijalankan otomatis di container saat start (`docker-entrypoint.sh`).

## Arsitektur

```
GitHub push (main → staging | live → production)
   └─ Dokploy git webhook → build Dockerfile → container start
        └─ entrypoint: prisma migrate deploy → node server.js
```

- **Branch:** `main` = staging, `live` = production.
- **Container dipisah:** App (Dockerfile) + Postgres (service Database Dokploy) terpisah.
- **2 environment:** staging & production, masing-masing punya App + Postgres sendiri.
- **DB:** Postgres self-hosted di Dokploy (`DB_NEON=false`). **Internal-only** (tidak di-expose ke internet).
- **Migration:** auto via entrypoint untuk staging & production.

---

## 1. Buat Postgres (2 instance)

Di Dokploy: **Create → Database → PostgreSQL** (dua kali).

| | Image | Catatan |
|---|---|---|
| `postgres-staging` | `postgres:16` | **Wajib `postgres:16`** (versi 18 bikin konflik volume) |
| `postgres-prod` | `postgres:16` | instance terpisah, volume sendiri |

Untuk masing-masing: set **User**, **Database name**, **Password** (kuat). Catat
**Internal Connection URL** (host internal seperti `xxx-postgres-yyy:5432`).

> **Jangan** set External Port (biarkan internal-only). App mengakses via internal host.
> Nyalakan **scheduled backup** untuk production (Dokploy bisa backup ke S3/R2).

---

## 2. Buat Application (2 environment)

Di Dokploy: **Create → Application** (dua kali).

| | Branch | Build Type | Domain |
|---|---|---|---|
| `swasana-staging` | `main` | **Dockerfile** | `staging.<domain>` |
| `swasana-prod` | `live` | **Dockerfile** | `app.<domain>` |

- **Source:** connect repo GitHub, pilih branch sesuai tabel.
- **Build Type:** Dockerfile (path: `Dockerfile`).
- **Port:** `3000`.
- **Auto Deploy:** ON (deploy otomatis tiap push ke branch tsb).
- **Domain + SSL:** set domain, aktifkan HTTPS (Traefik + Let's Encrypt otomatis).
- **Healthcheck path:** `/api/health`.

---

## 3. Environment variables (set manual per environment)

Set di tab **Environment** masing-masing Application. `NEXT_PUBLIC_*` juga harus
tersedia saat **build** (Dokploy menyuntikkannya sebagai build arg) — pastikan terisi
sebelum deploy pertama.

### Wajib (runtime + sebagian build-time)

```
# Database (pakai INTERNAL host Postgres Dokploy)
DB_NEON=false
DATABASE_URL=postgresql://USER:PASS@<internal-host>:5432/DBNAME?sslmode=disable
DIRECT_URL=postgresql://USER:PASS@<internal-host>:5432/DBNAME?sslmode=disable

# Auth (Auth.js v5)
AUTH_SECRET=<openssl rand -base64 32>     # staging ≠ production
AUTH_URL=https://<domain-env-ini>
AUTH_TRUST_HOST=true                       # WAJIB di belakang Traefik

# App
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://<domain-env-ini>

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=Swasana Wedding <noreply@yourdomain.com>

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=swasana-<env>
R2_PUBLIC_URL=https://pub-xxx.r2.dev
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Admin
CLEANUP_SECRET=<random>                    # staging ≠ production, jangan = AUTH_SECRET
```

### Opsional

```
NEXT_PUBLIC_SHOW_DEVTOOLS=false
PERURI_USERNAME=
PERURI_PASSWORD=
PERURI_ENV=staging   # atau production
```

> **Build-time:** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_R2_PUBLIC_URL`,
> `NEXT_PUBLIC_SHOW_DEVTOOLS` di-embed ke client bundle saat build. Kalau kosong saat
> build, nilainya kosong di browser. Pastikan terisi sebelum trigger build, dan
> redeploy kalau diubah.
>
> **Perbedaan staging vs production:** `AUTH_SECRET`, `CLEANUP_SECRET`, domain
> (`AUTH_URL`/`NEXT_PUBLIC_APP_URL`), `DATABASE_URL`/`DIRECT_URL`, dan bucket R2
> harus berbeda antar environment.

---

## 4. Deploy pertama & seed

1. Set semua env → **Deploy**. Cek **Deploy Logs**:
   - `[entrypoint] prisma migrate deploy...` → migrasi diterapkan.
   - `[entrypoint] starting Next.js standalone server...` → app start.
2. Cek healthcheck: `https://<domain>/api/health` → `{ "ok": true, ... }`.
3. **Seed data** (sekali, DB baru kosong) — jalankan dari Dokploy terminal App
   (atau lokal dengan `DATABASE_URL` mengarah ke DB tsb):
   ```
   npm run db:seed
   ```
   Membuat roles/permissions, brands/venues, packages, dan admin
   (`admin@swasana.com` / `Admin@1234`). Ganti password admin setelah login.

---

## 5. Operasional

- **Deploy berikutnya:** cukup `git push` ke `main`/`live` → Dokploy auto build & deploy. Migration jalan otomatis.
- **Migration baru:** commit file migrasi seperti biasa → terbawa saat deploy (entrypoint apply otomatis).
- **Akses DB dari laptop:** karena internal-only, pakai Dokploy terminal atau SSH
  tunnel. Jangan expose Postgres production ke internet.
- **Rollback:** gunakan fitur rollback Dokploy (deploy sebelumnya tetap tersimpan).

---

## Catatan

- `DB_NEON=true` mengembalikan app ke Neon (adapter serverless) tanpa ubah kode —
  toggle di env saja. Untuk Dokploy gunakan `false`.
- Rate limiter in-memory (reset saat restart) — cukup untuk single instance.
- Base image Debian slim (`node:20-bookworm-slim`) — diperlukan oleh `sharp` & Prisma.
- `prisma/schema.prisma` memakai `binaryTargets = ["native", "debian-openssl-3.0.x"]`
  agar engine cocok dengan container.
