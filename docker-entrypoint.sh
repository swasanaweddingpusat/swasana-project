#!/bin/sh
set -e

# Auto-apply pending migrations before the app accepts traffic.
# Idempotent: if nothing is pending, `migrate deploy` is a no-op.
# If it fails, the container exits non-zero → Dokploy keeps the previous
# version running and the error shows up in the deploy log.
echo "[entrypoint] prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting Next.js standalone server..."
exec node server.js
