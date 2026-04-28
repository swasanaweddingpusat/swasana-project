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
