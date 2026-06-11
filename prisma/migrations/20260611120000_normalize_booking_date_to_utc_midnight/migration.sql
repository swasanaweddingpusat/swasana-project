-- DATA MIGRATION: Normalize bookings.bookingDate to UTC midnight
--
-- BACKGROUND:
-- Before fix, bookingDate (a date-only event date) was written by calling
-- new Date(`${dateStr}T00:00:00+07:00`).toISOString() — which stored WIB midnight
-- (00:00 WIB = 17:00 UTC previous day, or equivalently the epoch for T17:00Z).
-- The new write path writes new Date(`${dateStr}T00:00:00.000Z`) — UTC midnight.
-- The read path uses getUTCFullYear/getUTCMonth/getUTCDate, so UTC midnight is correct.
--
-- Old data: stored as T17:00:00Z (WIB midnight of the intended event date).
-- This migration converts them to T00:00:00Z of the SAME calendar date (Jakarta view).
--
-- FORMULA TRACE (example: 2026-06-29 T17:00:00Z stored → intended date 2026-06-30):
--   "bookingDate" AT TIME ZONE 'Asia/Jakarta'  →  2026-06-30 00:00:00 (naive)
--   date_trunc('day', ...)                     →  2026-06-30 00:00:00 (naive)
--   ... AT TIME ZONE 'UTC'                     →  2026-06-30T00:00:00Z  ✅
--
-- IDEMPOTENT: The WHERE guard ensures rows already at UTC midnight (hour=0, min=0, sec=0)
-- are skipped — running this migration multiple times is safe.
--
-- SCOPE: Only bookings.bookingDate is affected.
--   - bookings.eventDate: nullable, 0 dirty rows in staging (confirmed by pre-migration query)
--   - leads.eventDate:    nullable, 0 dirty rows in staging (confirmed by pre-migration query)
--   - quotations.eventDate: nullable, 0 dirty rows (write path never used toISOString offset)
--   These fields are excluded from this migration (no data to fix, avoids over-reach).

UPDATE bookings
SET "bookingDate" = (date_trunc('day', "bookingDate" AT TIME ZONE 'Asia/Jakarta')) AT TIME ZONE 'UTC'
WHERE date_part('hour',   "bookingDate" AT TIME ZONE 'UTC') != 0
   OR date_part('minute', "bookingDate" AT TIME ZONE 'UTC') != 0
   OR date_part('second', "bookingDate" AT TIME ZONE 'UTC') != 0;
