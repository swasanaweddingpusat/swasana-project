#!/bin/sh
set -e

PRISMA="node node_modules/prisma/build/index.js"

# ── Auto-resolve failed migrations ──────────────────────────────────────────
# P3009 blocks ALL future deploys until someone manually resolves the failed
# migration. Since our migrations are idempotent (CLAUDE.md §6), marking a
# failed migration as rolled-back and re-running deploy is safe — the SQL
# will simply re-execute with IF NOT EXISTS / IF EXISTS guards.
echo "[entrypoint] checking for failed migrations..."
STATUS_OUTPUT=$($PRISMA migrate status 2>&1) || true

FAILED_MIGRATION=$(echo "$STATUS_OUTPUT" | grep -oP 'The `\K[^`]+(?=` migration.*failed)' || true)

if [ -n "$FAILED_MIGRATION" ]; then
  echo "[entrypoint] found failed migration: $FAILED_MIGRATION — auto-resolving..."
  $PRISMA migrate resolve --rolled-back "$FAILED_MIGRATION"
  echo "[entrypoint] resolved. Re-applying via migrate deploy..."
fi

# ── Apply pending migrations ────────────────────────────────────────────────
echo "[entrypoint] prisma migrate deploy..."
$PRISMA migrate deploy

echo "[entrypoint] starting Next.js standalone server..."
exec node server.js
