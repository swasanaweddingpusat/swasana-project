-- Tampilkan pembayaran (cash-in) di section Summary Payment PO PDF.
-- ADDITIVE + idempotent. Default false = zero-regression (PO tampil seperti sebelumnya).
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "showInPo" BOOLEAN NOT NULL DEFAULT false;
