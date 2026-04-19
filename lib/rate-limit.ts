// In-memory rate limiter — no external dependency, resets on cold start.
// Good enough for a small app. For high-traffic production, swap to Redis.

type RateEntry = { count: number; resetAt: number };
const store = new Map<string, RateEntry>();

function check(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}

// 5 requests per 15 minutes — auth flows (login, forgot-password, reset, verify)
export const authLimiter = {
  check: (key: string) => check(key, 5, 15 * 60 * 1000),
};

// 20 requests per minute — mutations (invite, update, delete)
export const mutationLimiter = {
  check: (key: string) => check(key, 20, 60 * 1000),
};

// 60 requests per minute — reads/lists
export const apiLimiter = {
  check: (key: string) => check(key, 60, 60 * 1000),
};

export function rateLimitResponse() {
  return Response.json(
    { error: "Terlalu banyak percobaan. Coba lagi nanti." },
    { status: 429 }
  );
}

export function rateLimitError() {
  return { error: "Terlalu banyak percobaan. Coba lagi nanti." } as const;
}
