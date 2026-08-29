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
ARG NEXT_PUBLIC_S3_PUBLIC_URL=""
ARG NEXT_PUBLIC_SHOW_DEVTOOLS="false"
# Server Actions encryption key. Next.js encrypts Server Action closures with a
# key that, by DEFAULT, is regenerated on EVERY build — so every redeploy rotates
# all Server Action IDs and any client still on an older shell fails with
# "Failed to find Server Action". Providing a STABLE key here keeps action IDs
# constant across deploys, so a stale client only breaks when that action's own
# code actually changed. Must be present at BUILD time (it's embedded in output).
# Empty default = keep Next's per-build behavior (no change) until Railway sets it.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=""
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_S3_PUBLIC_URL=$NEXT_PUBLIC_S3_PUBLIC_URL \
    NEXT_PUBLIC_SHOW_DEVTOOLS=$NEXT_PUBLIC_SHOW_DEVTOOLS \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
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

# sharp (Next.js image optimization) is a native module needing libvips. The
# `output: "standalone"` trace copies sharp + @img/sharp-linux-x64 but DROPS
# @img/sharp-libvips-linux-x64 (the actual libvips-cpp.so provider — its path is
# loaded dynamically so nft can't trace it), so the runtime hits
# ERR_DLOPEN_FAILED. Reinstalling via `npm install --os/--cpu` is flaky: npm
# frequently skips the NESTED optional dep @img/sharp-libvips-linux-x64. The
# builder stage already has a complete, version-matched linux-x64 sharp tree
# from `npm ci` (sharp 0.35.3, @img/sharp-linux-x64 0.35.3, libvips 1.3.2).
# Copy it wholesale over the partial traced copy — deterministic, no network.
RUN rm -rf node_modules/sharp node_modules/@img
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app/node_modules

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
