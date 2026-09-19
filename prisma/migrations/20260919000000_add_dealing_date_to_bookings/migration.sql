-- Add "dealingDate" column to "bookings".
-- Tanggal dealing booking; user-editable at create time (default hari ini),
-- backfilled dari "createdAt" untuk data lama. Nullable, non-destructive.
-- Idempotent: safe to run multiple times.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "dealingDate" TIMESTAMP(3);

UPDATE "bookings" SET "dealingDate" = "createdAt" WHERE "dealingDate" IS NULL;
