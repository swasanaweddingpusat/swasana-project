# 🚀 Panduan Deploy Swasana Project ke Netlify

**Last Updated:** April 28, 2026  
**Framework:** Next.js 16.2.3 | **Runtime:** Node 20+ | **Database:** PostgreSQL (Neon)

---

## 📋 Prerequisites

Sebelum memulai, pastikan Anda memiliki:

- ✅ **Akun Netlify** (gratis atau premium)
- ✅ **Repository GitHub** (push project ke GitHub terlebih dahulu)
- ✅ **Neon Database** (serverless PostgreSQL dengan HTTP adapter)
- ✅ **Environment Variables** yang siap
- ✅ **Cloudflare R2** (untuk storage, opsional - bisa skip jika development-only)
- ✅ **Resend API Key** (untuk email service)

---

## 🔧 Step 1: Persiapan Project

### 1.1 Cleanup & Build Test Lokal

```bash
# Terminal di project root
npm run build:clean    # Clear Turbopack cache
npm run typecheck      # Pastikan tidak ada TS errors
npm run build          # Test build berhasil
```

### 1.2 Setup Environment Variables Lokal

Buat `.env.local` di root:

```env
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
DIRECT_URL=postgresql://[user]:[password]@[host]/[dbname]?sslmode=require

# Auth
AUTH_SECRET=your-secret-generated-with-openssl
AUTH_URL=http://localhost:3000

# Email
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket-name

# App URLs
APP_URL=http://localhost:3000

# Admin
CLEANUP_SECRET=your-cleanup-secret
```

### 1.3 Generate AUTH_SECRET

```bash
# Jalankan di terminal
openssl rand -base64 32

# Copy output ke AUTH_SECRET
```

### 1.4 Uji Database Lokal

```bash
# Test koneksi database
npm run db:generate      # Generate Prisma Client
npm run db:migrate       # Run migrations (jika ada)

# Seed data (opsional, untuk development)
npm run db:seed:roles
npm run db:seed:reference
```

---

## 🌐 Step 2: Push ke GitHub

```bash
# Commit semua changes
git add .
git commit -m "chore: prepare for Netlify deployment"

# Push ke main branch (atau sesuaikan nama branch)
git push origin main
```

---

## 🔗 Step 3: Deploy ke Netlify

### 3.1 Koneksi Repository

1. Buka https://app.netlify.com
2. Klik **"New site from Git"**
3. Pilih **GitHub** → authorize jika perlu
4. Pilih repository: **swasana-project**
5. Klik **Deploy site**

### 3.2 Build Settings

Di Netlify dashboard → **Site settings** → **Build & deploy**:

**Build command:**
```bash
npm run build
```

**Publish directory:**
```
.next
```

**Output directory (untuk serverless functions):**
```
.netlify/functions
```

Klik **Save**

---

## 🔐 Step 4: Configure Environment Variables

1. Netlify Dashboard → **Site settings** → **Environment variables**
2. Klik **Add environment variable** untuk setiap variable:

```
DATABASE_URL = postgresql://...
DIRECT_URL = postgresql://...
AUTH_SECRET = (generated dengan openssl)
AUTH_URL = https://your-netlify-domain.netlify.app
RESEND_API_KEY = ...
RESEND_FROM_EMAIL = noreply@yourdomain.com
R2_ACCOUNT_ID = ...
R2_ACCESS_KEY_ID = ...
R2_SECRET_ACCESS_KEY = ...
R2_BUCKET = ...
APP_URL = https://your-netlify-domain.netlify.app
CLEANUP_SECRET = ...
```

⚠️ **PENTING:** Pastikan `AUTH_URL` dan `APP_URL` menggunakan domain Netlify atau custom domain Anda (HTTPS required)

---

## 📦 Step 5: Database Migrations di Netlify

Karena Netlify tidak memiliki long-running build process, migration harus dilakukan **sebelum** atau **sesudah** deploy:

### Opsi A: Pre-Deployment Migration (RECOMMENDED)

Jalankan di local machine sebelum push:

```bash
# Pastikan environment sudah di .env.local
npm run db:migrate:deploy
npm run db:seed:roles
npm run db:seed:reference
```

### Opsi B: Post-Deployment (Via Netlify Function)

Jika perlu auto-migrate setelah deploy, buat file `netlify/functions/migrate.ts`:

```typescript
import { Handler } from "@netlify/functions";
import { execSync } from "child_process";

export const handler: Handler = async (event) => {
  // Require SECRET_TOKEN header untuk keamanan
  if (event.headers["x-migration-token"] !== process.env.MIGRATION_TOKEN) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const output = execSync("npx prisma migrate deploy", { encoding: "utf-8" });
    return { statusCode: 200, body: `Migration completed: ${output}` };
  } catch (error) {
    return { statusCode: 500, body: `Migration failed: ${(error as Error).message}` };
  }
};
```

Trigger setelah deploy:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/migrate \
  -H "x-migration-token: your-secret-token"
```

---

## 🎯 Step 6: Custom Domain (Optional)

1. Netlify Dashboard → **Site settings** → **Domain management**
2. Klik **Add custom domain**
3. Masukkan domain (e.g., `app.swasana.com`)
4. Update DNS records sesuai instruksi Netlify
5. **Update `AUTH_URL` dan `APP_URL` di environment variables!**

---

## ⚠️ Important Configuration Notes

### Next.js Configuration

File `next.config.ts` sudah benar untuk Netlify:

```typescript
const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
};
```

### Timeout Considerations

Netlify functions punya batas timeout:
- **Free tier:** 10 detik
- **Pro tier:** 26 detik
- **Paid tier:** 26 detik

Untuk operations yang lebih lama, pertimbangkan:
- Database seeding → lakukan lokal
- Bulk operations → paginate / queue
- Background jobs → gunakan Netlify Scheduled Functions

### Rate Limiting pada Serverless

Project ini menggunakan **in-memory rate limiter**. Pada serverless:
- ✅ Cold start = rate limiter reset (acceptable untuk security)
- ✅ Warm instance = rate limit persists across requests
- ✅ Database-backed lockout tetap work (ActivityLog table)

---

## 🧪 Step 7: Testing Post-Deployment

### 7.1 Health Check

```bash
# Visit
https://your-site.netlify.app

# Should load login page without errors
```

### 7.2 API Endpoints

```bash
# Check API health
curl https://your-site.netlify.app/api/health

# Check auth endpoint
curl https://your-site.netlify.app/api/auth/signin
```

### 7.3 Database Connection

```bash
# Login ke app → check dashboard loads
# If seed data exists, should see packages/venues etc
```

### 7.4 Environment Variable Check

Di Netlify Function atau server action, verify env vars loaded:

```typescript
// actions/debug.ts
"use server";
export async function checkEnv() {
  return {
    databaseConnected: !!process.env.DATABASE_URL,
    authSecretSet: !!process.env.AUTH_SECRET,
    appUrl: process.env.APP_URL,
  };
}
```

---

## 🔄 Continuous Deployment

Setelah setup awal, deployment otomatis akan:

1. **Trigger saat push ke branch utama** (default: `main`)
2. **Run build command** (`npm run build`)
3. **Deploy ke production** jika build sukses
4. **Rollback otomatis** jika ada error

### Deploy Preview (untuk Pull Requests)

Setiap PR akan auto-generate preview site:
- URL: `https://deploy-preview-N--your-site.netlify.app`
- Berguna untuk QA sebelum merge ke main

---

## 🚨 Troubleshooting

### Build Fails dengan "Cannot find module"

**Solusi:**
```bash
# Local: Clear cache dan rebuild
npm run build:clean
npm install
npm run build

# Push ulang ke GitHub
```

### Database Connection Timeout

**Penyebab:** `DIRECT_URL` tidak bekerja di production  
**Solusi:** Gunakan `DATABASE_URL` (HTTP adapter Prisma):

```env
DATABASE_URL=postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
DIRECT_URL=  # Keep empty or use DATABASE_URL
```

### AUTH_URL Mismatch Error

**Penyebab:** `AUTH_URL` di env tidak match domain  
**Solusi:** 
1. Update `AUTH_URL` di Netlify env vars
2. Trigger redeploy: **Deploys** → **Trigger deploy**

### Prisma Client Generation

**Error:** `@prisma/client not found`  
**Solusi:** Prisma generate perlu engine:

```bash
# Local: pastikan running sebelum commit
npm run db:generate
git add prisma/.prisma
git commit -m "chore: generate prisma client"
git push
```

---

## 📊 Monitoring & Logs

### View Deployment Logs

1. Netlify Dashboard → **Deploys**
2. Klik deployment terbaru
3. Lihat **Build log** dan **Function logs**

### Function Logs (Real-time)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Stream logs
netlify functions:invoke --name migration --stream
```

---

## 🔐 Security Best Practices

✅ **DO:**
- Use strong `AUTH_SECRET` (generated dengan openssl)
- Enable HTTPS (Netlify auto-enable)
- Rotate secrets setiap 3-6 bulan
- Use separate secrets untuk production vs staging
- Monitor audit logs (di database)

❌ **DON'T:**
- Commit `.env` ke git (add ke `.gitignore`)
- Share secrets via email/chat
- Use same secret untuk multiple services
- Enable public access ke database

---

## 🚀 Production Checklist

Sebelum go-live:

- [ ] Domain custom sudah setup dengan HTTPS
- [ ] `AUTH_URL` dan `APP_URL` diupdate ke domain production
- [ ] Database dibackup
- [ ] Email service (Resend) tested
- [ ] File storage (R2) configured
- [ ] Load testing completed
- [ ] Error handling & monitoring setup
- [ ] Rollback plan documented
- [ ] Team trained pada deployment process

---

## 📞 Support & Resources

- **Netlify Docs:** https://docs.netlify.com/
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs/
- **Neon Docs:** https://neon.tech/docs/

---

## 🔄 Rollback Procedure

Jika ada masalah di production:

1. **Netlify Dashboard → Deploys**
2. **Klik deployment sebelumnya yang working**
3. **Klik "Publish deploy"**
4. **Wait untuk re-deployment selesai**
5. **Test semua functionality**

---

**Good luck! 🎉**

Untuk questions atau issues, refer ke AGENTS.md untuk project conventions.
