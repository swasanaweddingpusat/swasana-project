-- FIX C (feat/finance-fixes) — Invoice jadi entity IMMUTABLE, on-demand, 1:1.
-- ADDITIVE + idempotent. TermOfPayment.invoiceNumber TIDAK di-drop di sini
-- (itu migration lanjutan, SETELAH semua reader dialihin ke Invoice — Fase 3
-- rencana Invoice Fase 3/Step 3 di plan). Backfill di bawah cuma nge-copy
-- TermOfPayment.invoiceNumber existing jadi baris Invoice historis.

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "InvoiceType" AS ENUM ('dp', 'progress', 'pelunasan', 'lainnya');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── invoices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "termId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'progress',
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FKs added via DO-block guarded ALTER so re-running this file is a no-op
-- once applied (constraint name already exists -> duplicate_object caught).
DO $$ BEGIN
    ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_bookingId_fkey";
    ALTER TABLE "invoices"
        ADD CONSTRAINT "invoices_bookingId_fkey"
        FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_termId_fkey";
    ALTER TABLE "invoices"
        ADD CONSTRAINT "invoices_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "term_of_payments" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_issuedById_fkey";
    ALTER TABLE "invoices"
        ADD CONSTRAINT "invoices_issuedById_fkey"
        FOREIGN KEY ("issuedById") REFERENCES "profiles" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_voidedById_fkey";
    ALTER TABLE "invoices"
        ADD CONSTRAINT "invoices_voidedById_fkey"
        FOREIGN KEY ("voidedById") REFERENCES "profiles" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "invoices_bookingId_idx" ON "invoices"("bookingId");
CREATE INDEX IF NOT EXISTS "invoices_termId_idx" ON "invoices"("termId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

-- ─── Backfill: TermOfPayment.invoiceNumber existing -> Invoice row ────────────
-- invoiceType derive dari sortOrder per booking: 0 -> dp, sortOrder terbesar
-- (per booking) -> pelunasan, sisanya -> progress. ON CONFLICT (invoiceNumber)
-- DO NOTHING => aman dijalankan ulang (idempotent).
INSERT INTO "invoices" (
    "id", "bookingId", "termId", "invoiceNumber", "invoiceType", "amount",
    "status", "issuedAt", "createdAt", "updatedAt"
)
SELECT
    'inv-backfill-' || t."id",
    t."bookingId",
    t."id",
    t."invoiceNumber",
    CASE
        WHEN t."sortOrder" = 0 THEN 'dp'::"InvoiceType"
        WHEN t."sortOrder" = maxso."maxSortOrder" THEN 'pelunasan'::"InvoiceType"
        ELSE 'progress'::"InvoiceType"
    END,
    t."amount",
    'issued'::"InvoiceStatus",
    t."createdAt",
    t."createdAt",
    CURRENT_TIMESTAMP
FROM "term_of_payments" t
JOIN (
    SELECT "bookingId", MAX("sortOrder") AS "maxSortOrder"
    FROM "term_of_payments"
    GROUP BY "bookingId"
) maxso ON maxso."bookingId" = t."bookingId"
WHERE t."invoiceNumber" IS NOT NULL
ON CONFLICT ("invoiceNumber") DO NOTHING;
