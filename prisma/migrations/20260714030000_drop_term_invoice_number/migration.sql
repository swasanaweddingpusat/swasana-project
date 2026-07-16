-- FIX C Step 3: drop kolom legacy TermOfPayment.invoiceNumber
-- Semua reader sudah dialihkan ke entity Invoice (tabel invoices).
-- Kolom Ledger.invoiceNumber TETAP ada (itu nomor kwitansi, bukan invoice termin).
-- Kolom Invoice.invoiceNumber TETAP ada (entity Invoice baru, immutable).

-- Drop unique constraint dulu (idempotent):
ALTER TABLE "term_of_payments" DROP CONSTRAINT IF EXISTS "term_of_payments_invoiceNumber_key";

-- Drop kolom (idempotent):
ALTER TABLE "term_of_payments" DROP COLUMN IF EXISTS "invoiceNumber";
