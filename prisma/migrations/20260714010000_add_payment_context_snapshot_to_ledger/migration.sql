-- Freeze konteks pembayaran (FIX B) — beku nama termin/package/venue di Ledger
-- SAAT cash-in dibuat. ADDITIVE + idempotent, nullable, no default.
-- Data lama (pre-migrasi) = null → label PO fallback ke live-join, zero regression.
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "snapTopName" TEXT;
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "snapPackageName" TEXT;
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "snapVenueName" TEXT;
