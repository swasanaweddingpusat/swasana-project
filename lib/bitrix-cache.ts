import { createHash } from "crypto";
import { redisGetJSON, redisSetJSON } from "@/lib/redis";

// Redis-backed read-through cache for Bitrix reads (see
// docs/redis-bitrix-cache-plan.md). Two thresholds, no Redis TTL:
//   - FRESH_WINDOW_MS: below this age, serve cache without hitting Bitrix.
//   - above it, try a live fetch; on failure, serve the stale cache instead
//     of erroring (however old it is — the key never expires on its own).
// The daily warmer (app/api/cron/bitrix-refresh) needs no special "force"
// path: it just calls the same query functions a real page load would, and
// because it only runs once a day (>> FRESH_WINDOW_MS), the read-through
// logic below always treats that call as stale and overwrites the cache.
export const FRESH_WINDOW_MS = 30 * 1000;

interface CachedEntry<T> {
  storedAt: number;
  data: T;
}

// Deterministic JSON stringify (sorted object keys) so the same params
// object always hashes to the same cache key regardless of key insertion
// order.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  // Byte-order (code-unit) sort, NOT localeCompare — key parity between the
  // route and the cron warmer must not depend on ICU/LANG at runtime.
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function bitrixCacheKey(method: string, params: Record<string, unknown>): string {
  const hash = createHash("sha256").update(stableStringify(params)).digest("hex").slice(0, 20);
  return `bitrix:${method}:${hash}`;
}

/**
 * Read-through cache-aside wrapper around a single Bitrix call.
 *
 * Fresh cache (< FRESH_WINDOW_MS old) → served directly, no Bitrix hit.
 * Stale or missing cache → live fetch; success overwrites the cache
 * (no TTL — persists until the next overwrite or an LRU eviction). If the
 * live fetch fails, the last cached value is served regardless of age; only
 * a cold cache (never fetched before) with a failing live fetch propagates
 * the error.
 */
export async function withBitrixCache<T>(
  method: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
): Promise<T> {
  const key = bitrixCacheKey(method, params);
  const cached = await redisGetJSON<CachedEntry<T>>(key);

  if (cached && Date.now() - cached.storedAt < FRESH_WINDOW_MS) {
    return cached.data;
  }

  try {
    const data = await fetcher();
    const entry: CachedEntry<T> = { storedAt: Date.now(), data };
    await redisSetJSON(key, entry);
    return data;
  } catch (e) {
    if (cached) {
      console.error(`[bitrix-cache] live fetch failed for "${method}", serving stale cache:`, (e as Error).message);
      return cached.data;
    }
    throw e;
  }
}
