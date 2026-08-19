import Redis from "ioredis";

// Redis is an optional resilience layer for Bitrix caching (see
// docs/redis-bitrix-cache-plan.md) — never a new point of failure. Every
// helper below swallows connection/command errors and returns a "miss"
// instead of throwing, so callers can always fall through to a live Bitrix
// fetch.
//
// The cache is OFF by default. It only turns on when REDIS_ENABLED === "true"
// AND REDIS_URL is set — an explicit per-environment switch (production on,
// staging/local opt-in). Any other combination makes `getRedisClient()`
// return null and every helper becomes a silent no-op.

const REDIS_ENABLED = process.env.REDIS_ENABLED === "true";
const REDIS_URL = process.env.REDIS_URL;

// Cooldown after a failed connect attempt — see the gate in ensureConnected.
let lastConnectFailureAt: number | null = null;
const CONNECT_COOLDOWN_MS = 30_000;

function createRedisClient(): Redis | null {
  // Explicit off-switch: default false everywhere; must be opted in per env.
  if (!REDIS_ENABLED) return null;
  if (!REDIS_URL) return null;

  const client = new Redis(REDIS_URL, {
    // TCP keepalive so a proxy sitting between us and Redis (e.g. Railway's
    // public proxy, used for local dev) doesn't silently drop the socket
    // during idle periods. Without this, ioredis's `status` can still read
    // "ready" for a connection the proxy already closed, and the next
    // command fails with "Stream isn't writeable" instead of reconnecting.
    keepAlive: 10_000,
    // Offline queue is ON, but bounded by commandTimeout: if the socket
    // *does* get dropped (idle-out above, or a real blip), a command issued
    // in that window queues and waits for the automatic reconnect instead
    // of rejecting instantly — which otherwise starves withBitrixCache's
    // stale-serve fallback (a failed cache READ looks identical to "no
    // cache exists", so a concurrent Bitrix failure has nothing to fall
    // back to). commandTimeout caps the wait so a request falling through
    // to live Bitrix is never blocked long.
    enableOfflineQueue: true,
    commandTimeout: 3000,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  // ioredis crashes the process on an unhandled "error" event — this
  // listener is required even though we log nothing interesting here;
  // real failures surface at the call site via the try/catch below.
  client.on("error", () => {});

  return client;
}

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
};

export function getRedisClient(): Redis | null {
  if (globalForRedis.redis === undefined) {
    try {
      globalForRedis.redis = createRedisClient();
    } catch (e) {
      // A malformed REDIS_URL (e.g. an unresolved `${{Redis.REDIS_URL}}`
      // reference on Railway) can make the ioredis constructor throw
      // synchronously. Memoize null so the throw never propagates into a live
      // Bitrix read (the non-fatal contract) and we don't re-throw on every
      // subsequent call — the cache just no-ops until the env is fixed.
      console.error("[redis] client init failed:", (e as Error).message);
      globalForRedis.redis = null;
    }
  }
  return globalForRedis.redis;
}

async function ensureConnected(client: Redis): Promise<boolean> {
  if (client.status === "ready") return true;
  if (client.status === "connecting" || client.status === "connect") return true;
  // While Redis is configured but down, skip re-attempting a connect on
  // every read — each attempt would stall up to connectTimeout for a
  // connection that's going to fail anyway. Let the caller fall through to
  // live Bitrix immediately instead; the cooldown self-heals after
  // CONNECT_COOLDOWN_MS so we retry once the window elapses.
  if (lastConnectFailureAt !== null && Date.now() - lastConnectFailureAt < CONNECT_COOLDOWN_MS) {
    return false;
  }
  try {
    await client.connect();
    lastConnectFailureAt = null;
    return true;
  } catch (e) {
    console.error("[redis] connect failed:", (e as Error).message);
    lastConnectFailureAt = Date.now();
    return false;
  }
}

/**
 * Read a JSON value from Redis. Returns null on cache miss OR on any Redis
 * failure (connection down, timeout, bad JSON) — callers treat both the
 * same way: fall through to the live source.
 */
export async function redisGetJSON<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    if (!(await ensureConnected(client))) return null;
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[redis] GET ${key} failed:`, (e as Error).message);
    return null;
  }
}

/**
 * Write a JSON value to Redis with NO expiry (see §2 of the plan — keys
 * persist until explicitly replaced by a warmer or evicted by
 * `maxmemory-policy allkeys-lru`). Non-fatal: a write failure is logged and
 * swallowed, never thrown.
 */
export async function redisSetJSON(key: string, value: unknown): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    if (!(await ensureConnected(client))) return;
    await client.set(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[redis] SET ${key} failed:`, (e as Error).message);
  }
}
