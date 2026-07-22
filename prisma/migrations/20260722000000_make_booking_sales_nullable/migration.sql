-- Make Booking.salesId nullable so a booking can exist "tanpa PIC" (no sales
-- assigned) — e.g. after its sales is deactivated/detached. The FK to profiles
-- stays ON DELETE RESTRICT (we never hard-delete a sales that owns bookings; we
-- detach the booking instead). Idempotent: DROP NOT NULL is a no-op if already
-- nullable.
ALTER TABLE "bookings" ALTER COLUMN "salesId" DROP NOT NULL;
