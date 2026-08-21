#!/bin/sh
set -e

# Railway Cron Job entrypoint — hits app/api/cron/bitrix-refresh on a
# schedule (see docs/redis-bitrix-cache-plan.md §7-8). Deployed as its own
# Railway service (config-as-code in ./railway.json) so it stays a thin,
# fast-building image separate from the main Next.js app image.

if [ -z "$BITRIX_CRON_SECRET" ]; then
  echo "[cron] BITRIX_CRON_SECRET not set" >&2
  exit 1
fi

if [ -z "$CRON_TARGET_URL" ]; then
  echo "[cron] CRON_TARGET_URL not set" >&2
  exit 1
fi

echo "[cron] GET $CRON_TARGET_URL"
curl -sf -X GET \
  -H "Authorization: Bearer $BITRIX_CRON_SECRET" \
  "$CRON_TARGET_URL"
echo ""
