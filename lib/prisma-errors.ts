/**
 * Foreign-key / RESTRICT constraint codes, across every shape the active DB
 * adapter can surface:
 *   - "P2003" — Prisma's own foreign-key-violation code
 *   - "23503" — raw Postgres foreign_key_violation (NO ACTION default FKs)
 *   - "23001" — raw Postgres restrict_violation (FKs declared onDelete: Restrict)
 *
 * This repo declares its business FKs (booking.salesId, quotation.salesId, …)
 * with `onDelete: Restrict`, so a blocked delete raises SQLSTATE 23001, NOT
 * 23503. Same family, different code — we accept both.
 */
const FK_CONSTRAINT_CODES = new Set(["P2003", "23503", "23001"]);

/**
 * Walk an error and its `cause` chain, collecting any `code` / `originalCode`
 * string properties. Needed because the native `PrismaPg` / `PrismaNeon` driver
 * adapters wrap the failure in a `DriverAdapterError` whose Postgres SQLSTATE
 * lives at `err.cause.code` — a top-level `err.code` check misses it entirely
 * (this was the "Terjadi kesalahan saat menghapus pengguna" bug). A real
 * `Prisma.PrismaClientKnownRequestError` carries `.code` at depth 0, so the same
 * walk covers that shape too. Depth-bounded to stay safe against cyclic causes.
 */
function collectErrorCodes(err: unknown, depth: number, acc: string[]): string[] {
  if (depth > 4 || err === null || typeof err !== "object") return acc;
  const e = err as { code?: unknown; originalCode?: unknown; cause?: unknown };
  if (typeof e.code === "string") acc.push(e.code);
  if (typeof e.originalCode === "string") acc.push(e.originalCode);
  return collectErrorCodes(e.cause, depth + 1, acc);
}

/**
 * True when `err` is a foreign-key / RESTRICT constraint violation, regardless
 * of whether it arrives as a Prisma known-request error ("P2003") or a driver
 * adapter error carrying the raw Postgres SQLSTATE ("23503" / "23001") nested in
 * its `cause`. Mirrors the dual-code approach in `lib/booking-slot-error.ts`
 * (which accepts "P2002" OR "23505" for the analogous unique-violation case).
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return collectErrorCodes(err, 0, []).some((c) => FK_CONSTRAINT_CODES.has(c));
}
