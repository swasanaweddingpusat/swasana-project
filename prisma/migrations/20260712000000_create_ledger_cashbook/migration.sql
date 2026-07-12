-- Fase 1 (ADDITIVE — zero risk): Cashflow Ledger cashbook.
-- Nambah 3 tabel (ledgers, payment_allocations, payment_activities) + 2 kolom Booking
-- (recognizedAt/recognizedById) + migrate partial_payments -> ledgers(in) + payment_allocations.
-- TOP kolom lama TIDAK di-drop (ditunda Fase 5). Idempotent.

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "LedgerDirection" AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "LedgerAckStatus" AS ENUM ('pending', 'acknowledged', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "LedgerPaymentStatus" AS ENUM ('unpaid', 'paid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentActivityAction" AS ENUM ('created', 'acknowledged', 'rejected', 'voided');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── Booking: recognizedAt / recognizedById ──────────────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recognizedAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recognizedById" TEXT;

DO $$ BEGIN
    ALTER TABLE "bookings"
        ADD CONSTRAINT "bookings_recognizedById_fkey"
        FOREIGN KEY ("recognizedById") REFERENCES "profiles" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "bookings_recognizedById_idx" ON "bookings"("recognizedById");

-- ─── ledgers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ledgers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL DEFAULT 'in',
    "ackStatus" "LedgerAckStatus" NOT NULL DEFAULT 'pending',
    "paymentStatus" "LedgerPaymentStatus" NOT NULL DEFAULT 'paid',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "discountProgramId" TEXT,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "cashAmount" INTEGER NOT NULL,
    "paymentMethodId" TEXT,
    "evidence" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "acknowledgedSignature" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledgers_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ledgers_discountProgramId_fkey" FOREIGN KEY ("discountProgramId") REFERENCES "discount_programs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledgers_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledgers_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledgers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ledgers_invoiceNumber_key" ON "ledgers"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "ledgers_bookingId_direction_ackStatus_idx" ON "ledgers"("bookingId", "direction", "ackStatus");
CREATE INDEX IF NOT EXISTS "ledgers_discountProgramId_idx" ON "ledgers"("discountProgramId");
CREATE INDEX IF NOT EXISTS "ledgers_paymentMethodId_idx" ON "ledgers"("paymentMethodId");
CREATE INDEX IF NOT EXISTS "ledgers_acknowledgedById_idx" ON "ledgers"("acknowledgedById");
CREATE INDEX IF NOT EXISTS "ledgers_createdById_idx" ON "ledgers"("createdById");

-- ─── payment_allocations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ledgerId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_allocations_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_termId_fkey" FOREIGN KEY ("termId") REFERENCES "term_of_payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_allocations_ledgerId_termId_key" ON "payment_allocations"("ledgerId", "termId");
CREATE INDEX IF NOT EXISTS "payment_allocations_termId_idx" ON "payment_allocations"("termId");
CREATE INDEX IF NOT EXISTS "payment_allocations_ledgerId_idx" ON "payment_allocations"("ledgerId");

-- ─── payment_activities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ledgerId" TEXT NOT NULL,
    "action" "PaymentActivityAction" NOT NULL,
    "actorId" TEXT,
    "actorNameSnapshot" TEXT NOT NULL,
    "signature" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_activities_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payment_activities_ledgerId_createdAt_idx" ON "payment_activities"("ledgerId", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_activities_actorId_idx" ON "payment_activities"("actorId");

-- ─── Data migration: partial_payments -> ledgers(in) + payment_allocations ────
-- Guard: skip kalau sudah pernah jalan (idempotent by marker note prefix).
-- Statement terpisah (bukan data-modifying CTE) biar FK ledger<-allocation aman timing-nya.
-- ID deterministik (mig-pp-<ppId>, mig-gap-<termId>) → allocation nunjuk ledger tanpa RETURNING.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "ledgers" WHERE "notes" LIKE '[migrasi-pp]%' OR "notes" LIKE '[migrasi-gap]%') THEN

        -- Pass 1a: real partial_payments -> ledger(in) 1:1
        INSERT INTO "ledgers" (
            "id", "bookingId", "direction", "ackStatus", "paymentStatus",
            "occurredAt", "amount", "discountAmount", "cashAmount",
            "paymentMethodId", "evidence", "notes",
            "acknowledgedAt", "acknowledgedById", "createdById",
            "createdAt", "updatedAt"
        )
        SELECT
            'mig-pp-' || pp."id",
            t."bookingId",
            'in',
            CASE WHEN t."ackStatus" = 'acknowledged' THEN 'acknowledged'::"LedgerAckStatus" ELSE 'pending'::"LedgerAckStatus" END,
            'paid',
            pp."paidAt",
            pp."amount",
            0,
            pp."amount",
            t."paymentMethodId",
            pp."evidence",
            COALESCE('[migrasi-pp] ' || pp."notes", '[migrasi-pp]'),
            CASE WHEN t."ackStatus" = 'acknowledged' THEN t."acknowledgedAt" ELSE NULL END,
            CASE WHEN t."ackStatus" = 'acknowledged' THEN t."acknowledgedById" ELSE NULL END,
            NULL,
            pp."createdAt",
            CURRENT_TIMESTAMP
        FROM "partial_payments" pp
        JOIN "term_of_payments" t ON t."id" = pp."termId";

        -- Pass 1b: allocation 1:1 buat tiap partial_payment (nunjuk ledger mig-pp-<ppId>)
        INSERT INTO "payment_allocations" ("id", "ledgerId", "termId", "amount", "createdAt")
        SELECT
            'mig-alloc-' || pp."id",
            'mig-pp-' || pp."id",
            pp."termId",
            pp."amount",
            CURRENT_TIMESTAMP
        FROM "partial_payments" pp;

        -- Pass 2a: synthetic gap — term paid/partial yang Σpartial < amount → ledger(in) buat selisih
        INSERT INTO "ledgers" (
            "id", "bookingId", "direction", "ackStatus", "paymentStatus",
            "occurredAt", "amount", "discountAmount", "cashAmount",
            "paymentMethodId", "evidence", "notes",
            "acknowledgedAt", "acknowledgedById", "createdById",
            "createdAt", "updatedAt"
        )
        SELECT
            'mig-gap-' || g."termId",
            g."bookingId",
            'in',
            CASE WHEN g."ackStatus" = 'acknowledged' THEN 'acknowledged'::"LedgerAckStatus" ELSE 'pending'::"LedgerAckStatus" END,
            'paid',
            COALESCE(g."acknowledgedAt", g."termUpdatedAt"),
            g."gap",
            0,
            g."gap",
            g."paymentMethodId",
            NULL,
            '[migrasi-gap]',
            CASE WHEN g."ackStatus" = 'acknowledged' THEN g."acknowledgedAt" ELSE NULL END,
            CASE WHEN g."ackStatus" = 'acknowledged' THEN g."acknowledgedById" ELSE NULL END,
            NULL,
            COALESCE(g."acknowledgedAt", g."termUpdatedAt"),
            CURRENT_TIMESTAMP
        FROM (
            SELECT
                t."id"               AS "termId",
                t."bookingId"        AS "bookingId",
                t."paymentMethodId"  AS "paymentMethodId",
                t."ackStatus"        AS "ackStatus",
                t."acknowledgedAt"   AS "acknowledgedAt",
                t."acknowledgedById" AS "acknowledgedById",
                t."updatedAt"        AS "termUpdatedAt",
                t."amount" - COALESCE(SUM(pp."amount"), 0) AS "gap"
            FROM "term_of_payments" t
            LEFT JOIN "partial_payments" pp ON pp."termId" = t."id"
            WHERE t."paymentStatus" IN ('paid', 'partial')
            GROUP BY t."id"
            HAVING t."amount" - COALESCE(SUM(pp."amount"), 0) > 0
        ) g;

        -- Pass 2b: allocation buat tiap gap ledger
        INSERT INTO "payment_allocations" ("id", "ledgerId", "termId", "amount", "createdAt")
        SELECT
            'mig-gapalloc-' || g."termId",
            'mig-gap-' || g."termId",
            g."termId",
            g."gap",
            CURRENT_TIMESTAMP
        FROM (
            SELECT
                t."id" AS "termId",
                t."amount" - COALESCE(SUM(pp."amount"), 0) AS "gap"
            FROM "term_of_payments" t
            LEFT JOIN "partial_payments" pp ON pp."termId" = t."id"
            WHERE t."paymentStatus" IN ('paid', 'partial')
            GROUP BY t."id"
            HAVING t."amount" - COALESCE(SUM(pp."amount"), 0) > 0
        ) g;

    END IF;
END $$;
