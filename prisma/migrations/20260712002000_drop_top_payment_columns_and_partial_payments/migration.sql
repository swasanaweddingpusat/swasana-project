-- Fase 5 (CLEANUP — destruktif, aman setelah Fase 4 cutover): TOP jadi jadwal murni.
-- "Berapa terbayar" sepenuhnya DERIVED dari Ledger cash-in (PaymentAllocation ter-ack).
--
-- Aman karena:
--  • Data partial_payments SUDAH di-migrate ke ledgers(in)+payment_allocations di
--    migration Fase 1 (20260712000000_create_ledger_cashbook, marker-guarded, 2-pass).
--    Migrations jalan berurutan → saat file ini apply, datanya sudah pindah.
--  • Semua kode (reads/guards/writes) sudah berhenti mereferensi kolom ini (Fase 5 FE/actions).
--
-- DROP COLUMN otomatis membuang FK + index yang menempel di kolom itu (dependency),
-- jadi tidak perlu DROP CONSTRAINT eksplisit. Idempotent (IF EXISTS).

-- ─── term_of_payments: buang kolom pembayaran legacy (KEEP invoiceNumber §6.2) ──
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "paymentStatus";
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "paymentEvidence";
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "paymentMethodId";
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "ackStatus";
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "acknowledgedAt";
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "acknowledgedById";

-- ─── partial_payments: drop tabel (data sudah pindah ke ledgers di Fase 1) ──────
DROP TABLE IF EXISTS "partial_payments";

-- ─── enum TermOfPaymentStatus: yatim setelah paymentStatus di-drop ──────────────
DROP TYPE IF EXISTS "TermOfPaymentStatus";
