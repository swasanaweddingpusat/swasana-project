-- Migration: add_venue_availability_constraints
-- Adds a partial unique index on bookings(venueId, bookingDate, weddingSession)
-- for active (non-Canceled, non-Lost) bookings.
--
-- This enforces at the DB level that no two active bookings can share the
-- same venue + date + session slot. The server-side conflict check in
-- actions/booking.ts handles the fullday cross-blocking logic (a fullday
-- booking conflicts with morning/evening and vice-versa); this index
-- catches exact-duplicate sessions as a safety net.
--
-- NOTE: If there are existing data violations (duplicate active bookings
-- on the same venue+date+session), this index creation will fail.
-- In that case, clean up the duplicate data before running this migration.

CREATE UNIQUE INDEX IF NOT EXISTS "booking_venue_date_session_active_idx"
  ON "bookings" ("venueId", "bookingDate", "weddingSession")
  WHERE "bookingStatus" NOT IN ('Canceled', 'Lost');
