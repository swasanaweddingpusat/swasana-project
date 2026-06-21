import { Prisma } from "@prisma/client";

/** Names of the partial unique indexes that guard against double-booking a venue
 *  slot. Indexes (old → new) cooperate to catch P2002 regardless of which
 *  migration the DB is on:
 *    - booking_venue_date_session_active_idx  (sessioned, migration 20260530000001)
 *    - bookings_active_slot_nosession_unique  (NULL-session MICE, migration 20260606130000)
 *    - bookings_unique_active_slot            (consolidated, migration 20260620150000_normalize_event_date)
 */
const SLOT_INDEXES = [
  "booking_venue_date_session_active_idx",
  "bookings_active_slot_nosession_unique",
  "bookings_unique_active_slot",
];

/** User-facing message shown when a slot collision is caught at the DB layer.
 *  Kept identical to the app-level conflict messages for a consistent UX. */
export const SLOT_TAKEN_MESSAGE =
  "Slot venue di tanggal & sesi tersebut sudah dibooking.";

/**
 * Detects whether an error is the unique-violation thrown by one of the
 * active-slot guards on the bookings table. The Neon HTTP adapter surfaces this
 * as a Prisma known-request error whose `code` is either "P2002" (Prisma's own)
 * or the raw Postgres "23505" (unique_violation) — so we accept both.
 */
export function isSlotConflictError(e: unknown): boolean {
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2002" || e.code === "23505")
  ) {
    const haystack = `${JSON.stringify(e.meta ?? {})} ${e.message}`;
    return SLOT_INDEXES.some((idx) => haystack.includes(idx));
  }
  return false;
}
