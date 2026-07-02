import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Atomic counter increment. Uses UPSERT + RETURNING to guarantee no race conditions.
 * Key format example: "invoice-2026"
 */
export async function getNextSequence(key: string): Promise<number> {
  const [row] = await db.$queryRaw<[{ value: number }]>(
    Prisma.sql`INSERT INTO counters (id, value) VALUES (${key}, 1)
               ON CONFLICT (id) DO UPDATE SET value = counters.value + 1
               RETURNING value`
  );
  return row.value;
}

/**
 * Reserve a contiguous block of `count` sequence numbers in a single round-trip.
 * Increments the counter by `count` atomically and returns the ascending list of
 * the reserved values. Over the Neon HTTP adapter each DB call is a network
 * round-trip, so allocating N invoice numbers this way is 1 round-trip instead of
 * N sequential `getNextSequence` calls.
 *
 * Example: counter at 40, count=3 → RETURNING 43 → [41, 42, 43].
 */
export async function getNextSequenceBatch(key: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  const [row] = await db.$queryRaw<[{ value: number }]>(
    Prisma.sql`INSERT INTO counters (id, value) VALUES (${key}, ${count})
               ON CONFLICT (id) DO UPDATE SET value = counters.value + ${count}
               RETURNING value`
  );
  const top = row.value;
  const start = top - count + 1;
  return Array.from({ length: count }, (_, i) => start + i);
}
