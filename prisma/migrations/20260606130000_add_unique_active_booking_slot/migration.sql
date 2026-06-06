-- Atomic anti-double-booking guard.
--
-- Prevents two ACTIVE bookings from occupying the same venue + date + session.
-- This is the DB-level safety net behind the app-level conflict checks in
-- actions/booking.ts, actions/booking-mice-draft.ts, and actions/booking-slot.ts,
-- closing the TOCTOU race where two concurrent "Deal" clicks both pass the
-- pre-insert findFirst() and both insert.
--
-- Scope mirrors the app checks exactly:
--   * Only recordStatus = 'saved' counts (drafts may freely collide).
--   * Canceled / Lost bookings are excluded (their slot is freed).
--
-- Implemented as TWO partial unique indexes instead of one COALESCE expression,
-- because casting an enum to text (COALESCE(weddingSession::text, ...)) is not
-- IMMUTABLE and Postgres rejects it inside an index expression.
--   1. Sessioned bookings: unique on (venue, date, session). Because a plain
--      unique index treats NULL <> NULL, NULL-session rows are excluded here...
--   2. ...and handled by a second index that blocks two NULL-session (legacy
--      MICE) bookings on the same venue + date.
--
-- NOTE: catches EXACT slot collisions only. The fullday-vs-morning/evening
-- overlap stays enforced at the application layer — a unique index cannot
-- express that without a GiST exclusion constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_active_slot_unique"
  ON "bookings" ("venueId", "bookingDate", "weddingSession")
  WHERE "recordStatus" = 'saved'
    AND "bookingStatus" NOT IN ('Canceled', 'Lost')
    AND "weddingSession" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_active_slot_nosession_unique"
  ON "bookings" ("venueId", "bookingDate")
  WHERE "recordStatus" = 'saved'
    AND "bookingStatus" NOT IN ('Canceled', 'Lost')
    AND "weddingSession" IS NULL;
