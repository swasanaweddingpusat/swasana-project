# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Swasana — multi-stage Docker build for Dokploy/VPS (Next.js 16 standalone)
# Base: Debian slim (NOT Alpine) — required by sharp + Prisma engines.
# ─────────────────────────────────────────────────────────────────────────────

# ── deps: install node_modules (postinstall runs `prisma generate`) ──────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Pin npm to the latest release (base image ships an older 10.x).
RUN npm install -g npm@11.17.0
# openssl + ca-certificates: Prisma engine runtime needs them
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Dummy URL so the postinstall `prisma generate` resolves env("DATABASE_URL").
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npm ci

# ── builder: compile Next.js standalone output ───────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Pin npm to the latest release (base image ships an older 10.x).
RUN npm install -g npm@11.17.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must
# be present here. Dokploy passes these as build args/env. Defaults are empty.
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_R2_PUBLIC_URL=""
ARG NEXT_PUBLIC_SHOW_DEVTOOLS="false"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL \
    NEXT_PUBLIC_SHOW_DEVTOOLS=$NEXT_PUBLIC_SHOW_DEVTOOLS \
    NEXT_TELEMETRY_DISABLED=1
# Dummy URL so any build-time prisma access resolves; real URL injected at runtime.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npm run build

# ── runner: minimal runtime image ────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Pin npm to the latest release (base image ships an older 10.x).
RUN npm install -g npm@11.17.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Non-root user (security)
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Prisma CLI for `migrate deploy` at startup. Installed via npm (not copied)
# so all its transitive deps (effect, @prisma/config, engines, …) resolve
# correctly. @next/env is the only extra dep prisma.config.ts needs.
RUN npm install --no-save --no-audit --no-fund prisma@7.8.0 @next/env@16.2.3 \
  && npm cache clean --force

# Standalone server + static assets + public (merges into /app/node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema + migrations + config + generated client/engine for migrate.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app/node_modules

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
