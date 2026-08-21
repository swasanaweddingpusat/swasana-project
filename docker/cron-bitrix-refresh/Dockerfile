# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Bitrix Redis cache warmer — Railway Cron Job image.
# Deliberately NOT the main app Dockerfile: this container only needs curl,
# runs once per schedule, and exits (see docs/redis-bitrix-cache-plan.md §7-8).
# ─────────────────────────────────────────────────────────────────────────────

FROM alpine:3.20
RUN apk add --no-cache curl
COPY run.sh /run.sh
RUN chmod +x /run.sh
ENTRYPOINT ["/run.sh"]
