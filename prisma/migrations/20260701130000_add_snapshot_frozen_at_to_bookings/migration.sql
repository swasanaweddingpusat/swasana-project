-- Migration: add_snapshot_frozen_at_to_bookings
-- Adds snapshotFrozenAt to bookings. Set when the client signs the agreement,
-- freezing the snapshot layer (SnapCustomer, internal items, pricing). After this
-- only vendor items stay editable; internal/price/pax edits require a new revision.

-- Add column (idempotent)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "snapshotFrozenAt" TIMESTAMP(3);
