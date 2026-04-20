# Infrastructure Plan — Swasana Project

## Production Stack

| Layer | Service | Cost/bulan |
|-------|---------|-----------|
| Database | Biznet Gio NEO Lite VPS + PostgreSQL | Rp 109.000 |
| File Storage | Cloudflare R2 | Rp 0 (free 10 GB) |
| Hosting | Vercel (Next.js) | Rp 0 (free tier) |
| **Total** | | **Rp 109.000/bulan** |

---

## Database — Biznet Gio NEO Lite MS 2.2

**Harga:** Rp 109.000/bulan (bulanan, bisa cancel kapan aja)

**Spec:**
- 2 vCPU
- 2 GB RAM
- 60 GB SSD (expandable)
- Bandwidth: Unlimited & Gratis
- Datacenter: Jakarta
- DDoS Protection + Firewall
- Root Access (KVM)
- Snapshot Backup

**Upgrade path (jika perlu):**

| Paket | Spec | Harga |
|-------|------|-------|
| MS 2.2 | 2 vCPU, 2 GB RAM, 60 GB SSD | Rp 109.000/mo |
| MS 4.4 | 4 vCPU, 4 GB RAM, 60 GB SSD | Rp 179.000/mo |
| MM 8.4 | 4 vCPU, 8 GB RAM, 60 GB SSD | Rp 269.000/mo |

**Kapasitas:** 300-350 users, booking system, audit logs — cukup di MS 2.2.

**Website:** https://www.biznetgio.com/en/product/neo-lite

---

## File Storage — Cloudflare R2

**Harga:** Free tier (10 GB storage, 10M GET requests/mo, 1M PUT requests/mo)

| Item | Free | Paid (jika melebihi) |
|------|------|---------------------|
| Storage | 10 GB | $0.015/GB/mo |
| Egress (download) | Unlimited | Unlimited (gratis) |
| GET requests | 10M/mo | $0.36/million |
| PUT requests | 1M/mo | $4.50/million |

**Estimasi:** Untuk foto venue, dokumen booking, PDF — 10 GB free tier cukup untuk 1-2 tahun pertama.

---

## Hosting — Vercel

**Harga:** Free (Hobby plan)

| Item | Limit |
|------|-------|
| Bandwidth | 100 GB/mo |
| Serverless Function | 100 GB-hrs/mo |
| Builds | 6000 min/mo |
| Team members | 1 |

**Kapan upgrade ($20/mo Pro):** Jika traffic > 100 GB/mo atau butuh team collaboration.

---

## Migrasi dari Neon ke Biznet Gio VPS

### Yang berubah di code:

1. Hapus dependencies:
   ```
   npm uninstall @prisma/adapter-neon @neondatabase/serverless
   ```

2. Simplify `lib/db.ts`:
   ```ts
   import { PrismaClient } from "@prisma/client";

   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
   export const db = globalForPrisma.prisma ?? new PrismaClient();
   if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
   ```

3. Update `.env`:
   ```
   DATABASE_URL="postgresql://swasana_user:PASSWORD@IP_VPS:5432/swasana_production"
   ```

4. Deploy migration:
   ```
   npx prisma migrate deploy
   ```

### Setup PostgreSQL di VPS:

```bash
# Install PostgreSQL
sudo apt update && sudo apt install postgresql postgresql-contrib -y

# Create database & user
sudo -u postgres psql
CREATE USER swasana_user WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE swasana_production OWNER swasana_user;
GRANT ALL PRIVILEGES ON DATABASE swasana_production TO swasana_user;
\q

# Allow remote connections
sudo nano /etc/postgresql/16/main/postgresql.conf
# → listen_addresses = '*'

sudo nano /etc/postgresql/16/main/pg_hba.conf
# → host all all 0.0.0.0/0 scram-sha-256

sudo systemctl restart postgresql

# Firewall
sudo ufw allow 5432/tcp
```

### Backup (cron harian):

```bash
# /etc/cron.d/pg-backup
0 2 * * * postgres pg_dump swasana_production | gzip > /backups/swasana_$(date +\%Y\%m\%d).sql.gz
```

---

## Perbandingan Cost

| Setup | Cost/bulan | Notes |
|-------|-----------|-------|
| **Biznet Gio VPS (recommended)** | Rp 109.000 | Self-host PostgreSQL, Jakarta DC |
| Neon (current, managed) | Rp 800rb - 1.3jt | Usage-based, auto-scale |
| Railway | Rp 900rb+ | Usage-based |
| Supabase Pro | Rp 400rb | Managed, tapi perlu rewrite adapter |

---

## Timeline

1. **Sekarang:** Development di Neon free tier
2. **Pre-production:** Setup Biznet Gio VPS + PostgreSQL
3. **Production:** Migrate data, switch DATABASE_URL, deploy
