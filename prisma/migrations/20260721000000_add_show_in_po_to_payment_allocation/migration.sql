-- Tampilkan porsi alokasi (per termin) di section Summary Payment PO PDF.
-- Granular per-termin: menggantikan flag per-cash-in (ledgers.showInPo) sebagai
-- sumber kebenaran render PO. ADDITIVE + idempotent.
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "showInPo" BOOLEAN NOT NULL DEFAULT false;

-- Backfill zero-regression: alokasi milik cash-in yang dulu ber-flag showInPo=true
-- ikut dinyalakan, supaya PO booking lama tetap menampilkan pembayaran tsb
-- (kini rinci per-termin, total & sisa bayar identik).
UPDATE "payment_allocations" pa
SET "showInPo" = true
FROM "ledgers" l
WHERE pa."ledgerId" = l."id"
  AND l."showInPo" = true;
