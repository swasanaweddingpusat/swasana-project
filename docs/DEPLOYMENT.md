# Deployment — Dokploy (VPS)

Project ini deploy ke **Dokploy** (self-hosted di VPS), bukan Vercel. Build
dilakukan oleh Dokploy dari `Dockerfile` (multi-stage, Next.js 16 standalone).
Migration dijalankan otomatis di container saat start (`docker-entrypoint.sh`).

## Arsitektur

```
Buka PR ke main/live
   └─ ci.yml: lint + typecheck + build  ← GATE (wajib lulus sebelum merge)

Merge → push ke main (staging) / live (production)
   └─ GitHub native webhook (Settings → Webhooks) → Dokploy /api/deploy/<token>
        └─ Dokploy cek branch dari payload → match → build Dockerfile → container start
             └─ entrypoint: prisma migrate deploy → node server.js
```

Alur: **PR → CI lulus → merge → GitHub webhook → Dokploy deploy**.
Deploy dipicu oleh **GitHub native webhook** (Settings → Webhooks), bukan GitHub
Action. Dokploy webhook (`/api/deploy/<token>`) butuh payload push GitHub yang
berisi info branch untuk mencocokkan branch yang di-watch app (mis. `main`).
`curl` polos tanpa payload akan ditolak dengan `{"message":"Branch Not Match"}`.

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

## 5. CI/CD — gate PR + auto-deploy via webhook

Alur: **PR → CI lulus → merge → GitHub native webhook → Dokploy deploy.**

Deploy dipicu **GitHub native webhook** (bukan GitHub Action). Webhook Dokploy
mencocokkan branch dari payload push GitHub dengan branch yang di-watch app,
jadi push ke `main` hanya men-deploy app staging (branch `main`), push ke `live`
hanya men-deploy app production. `curl` polos ditolak `{"message":"Branch Not Match"}`
karena tidak membawa payload branch — itulah kenapa pakai webhook native, bukan Action.

### a. Ambil webhook URL dari Dokploy
Tiap Application punya deploy webhook sendiri. Di Dokploy → Application →
**Deployments** (atau tab Webhook) → copy URL, formatnya:
```
http://<vps-ip>:3000/api/deploy/<token>
```
Ada **dua** URL berbeda: satu untuk app staging (branch `main`), satu untuk app
production (branch `live`).

### b. Daftarkan sebagai GitHub Webhook (native)
Repo → **Settings → Webhooks → Add webhook**, untuk MASING-MASING URL:

| Field | Isi |
|---|---|
| **Payload URL** | webhook URL dari Dokploy (staging / production) |
| **Content type** | `application/json` |
| **Secret** | kosongkan (kecuali Dokploy memintanya) |
| **Which events** | **Just the push event** |
| **Active** | ✅ |

Dokploy app staging watch `main` → hanya push ke `main` yang ter-deploy ke staging.
App production watch `live` → hanya push ke `live` yang ter-deploy ke production.
Branch lain (mis. `feat/*`) otomatis ditolak Dokploy (branch tidak match) — aman.

### c. Branch protection (jadikan CI sebagai gate wajib)
Repo → **Settings → Branches → Add branch ruleset / protection rule** untuk `main`
(dan `live`):
- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass** → pilih check **`Validate (lint + typecheck + build)`** (dari `ci.yml`)
- (opsional) Require branches up to date before merging

Dengan ini, PR **tidak bisa di-merge** (tombol Merge disabled) sampai CI lulus.
Setelah merge ke `main`/`live`, GitHub webhook men-trigger Dokploy deploy.

---

## 6. Operasional

- **Deploy berikutnya:** merge PR ke `main`/`live` → GitHub webhook → Dokploy build & deploy. Migration jalan otomatis di entrypoint.
- **Deploy manual:** kapan saja lewat tombol **Deploy** / **Redeploy** di Dokploy UI (tidak butuh push).
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
