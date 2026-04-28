# 🚀 Netlify Deployment Quick Start

Ikuti langkah-langkah ini untuk deploy ke Netlify dalam 15 menit:

## ✅ Pre-Deployment (Local Machine)

```bash
# 1. Clear cache & test build
npm run build:clean
npm run build

# 2. Test database connection
npm run db:generate
npm run db:migrate:deploy

# 3. Seed reference data (PROD only if needed)
npm run db:seed:roles
npm run db:seed:reference

# 4. Push ke GitHub
git add .
git commit -m "chore: ready for Netlify deployment"
git push origin main
```

## 🔐 Environment Variables Required

Kumpulkan semua ini terlebih dahulu:

```
DATABASE_URL          → Neon connection string (dengan ?sslmode=require)
DIRECT_URL            → (bisa kosong atau sama dengan DATABASE_URL)
AUTH_SECRET           → openssl rand -base64 32
AUTH_URL              → https://your-netlify-domain.netlify.app
RESEND_API_KEY        → Dari Resend dashboard
RESEND_FROM_EMAIL     → noreply@yourdomain.com
R2_ACCOUNT_ID         → Cloudflare R2
R2_ACCESS_KEY_ID      → Cloudflare R2
R2_SECRET_ACCESS_KEY  → Cloudflare R2
R2_BUCKET             → Cloudflare R2 bucket name
APP_URL               → https://your-netlify-domain.netlify.app
CLEANUP_SECRET        → random secure string
```

## 🌐 Deploy ke Netlify

### 1️⃣ Connect Repository

1. Go to https://app.netlify.com
2. Click **"New site from Git"**
3. Select **GitHub** → swasana-project repo

### 2️⃣ Configure Build

- **Build command:** `npm run build`
- **Publish directory:** `.next`
- Click **"Deploy site"**

### 3️⃣ Add Environment Variables

After deployment:

1. Go to **Site settings** → **Environment variables**
2. Add all variables from the list above
3. Click **"Trigger deploy"** from **Deploys** tab

### 4️⃣ Setup Custom Domain (Optional)

1. **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Add your domain
4. Follow DNS configuration
5. **Update AUTH_URL & APP_URL in env vars!**

## ✨ Post-Deployment

```bash
# Test the deployed site
curl https://your-site.netlify.app

# Check API
curl https://your-site.netlify.app/api/health
```

## 🎯 Common Issues

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm run build:clean` locally, push again |
| DB connection error | Verify DATABASE_URL includes `?sslmode=require` |
| AUTH_URL mismatch | Update AUTH_URL env var to match your domain |
| Prisma errors | Run `npm run db:generate` locally, commit, push |

## 📊 Monitoring

- **Build logs:** Netlify Dashboard → Deploys → click deployment
- **Function logs:** `netlify logs:functions`
- **Database:** Check Neon dashboard

## 🔄 Deploy Again

```bash
# Make changes locally
# ...
git add .
git commit -m "fix: something"
git push origin main

# Auto-deployed! Check Netlify dashboard
```

## ⚠️ Important Notes

✅ Netlify auto-redirects HTTP → HTTPS  
✅ Supports Node.js 20+  
✅ In-memory rate limiter resets on cold start (acceptable)  
✅ Use DRECT_URL only for local migrations, not production  
❌ Don't commit .env to git  
❌ Don't skip database migrations  
❌ Don't use same AUTH_SECRET across projects  

---

**Need help?** See `DEPLOYMENT_NETLIFY.md` for detailed guide.
