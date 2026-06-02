-- Migration: create_quotation_tables
-- Idempotent: uses IF NOT EXISTS / DO NOTHING guards

-- ─── Enum ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuotationStatus') THEN
    CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'sent', 'revised', 'accepted', 'rejected');
  END IF;
END
$$;

-- ─── quotations ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quotations" (
  "id"              TEXT        NOT NULL,
  "quotationNo"     TEXT,
  "category"        "EventCategory"   NOT NULL DEFAULT 'WEDDINGS',
  "status"          "QuotationStatus" NOT NULL DEFAULT 'draft',
  "clientName"      TEXT        NOT NULL,
  "clientPhone"     TEXT        NOT NULL,
  "instansi"        TEXT,
  "salesId"         TEXT        NOT NULL,
  "venueId"         TEXT        NOT NULL,
  "eventTypeId"     TEXT,
  "eventTypeName"   TEXT,
  "venueName"       TEXT,
  "weddingSession"  "WeddingSession",
  "eventDate"       TIMESTAMP(3),
  "time"            TEXT,
  "details"         TEXT,
  "subtotal"        INTEGER     NOT NULL DEFAULT 0,
  "discount"        INTEGER     NOT NULL DEFAULT 0,
  "totalPrice"      INTEGER     NOT NULL DEFAULT 0,
  "validUntil"      TIMESTAMP(3),
  "notes"           TEXT,
  "signingLocation" TEXT,
  "signatureSales"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- FK constraints (add only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_salesId_fkey'
  ) THEN
    ALTER TABLE "quotations"
      ADD CONSTRAINT "quotations_salesId_fkey"
      FOREIGN KEY ("salesId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_venueId_fkey'
  ) THEN
    ALTER TABLE "quotations"
      ADD CONSTRAINT "quotations_venueId_fkey"
      FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_eventTypeId_fkey'
  ) THEN
    ALTER TABLE "quotations"
      ADD CONSTRAINT "quotations_eventTypeId_fkey"
      FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "quotations_salesId_idx"   ON "quotations"("salesId");
CREATE INDEX IF NOT EXISTS "quotations_venueId_idx"   ON "quotations"("venueId");
CREATE INDEX IF NOT EXISTS "quotations_eventTypeId_idx" ON "quotations"("eventTypeId");
CREATE INDEX IF NOT EXISTS "quotations_status_idx"    ON "quotations"("status");
CREATE INDEX IF NOT EXISTS "quotations_createdAt_idx" ON "quotations"("createdAt");

-- ─── quotation_items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quotation_items" (
  "id"          TEXT        NOT NULL,
  "quotationId" TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "description" TEXT,
  "qty"         INTEGER     NOT NULL DEFAULT 0,
  "price"       INTEGER     NOT NULL DEFAULT 0,
  "total"       INTEGER     NOT NULL DEFAULT 0,
  "manualTotal" BOOLEAN     NOT NULL DEFAULT false,
  "sortOrder"   INTEGER     NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_quotationId_fkey'
  ) THEN
    ALTER TABLE "quotation_items"
      ADD CONSTRAINT "quotation_items_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- ─── quotation_terms ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quotation_terms" (
  "id"            TEXT        NOT NULL,
  "quotationId"   TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "amount"        INTEGER     NOT NULL,
  "dueDate"       TIMESTAMP(3),
  "sortOrder"     INTEGER     NOT NULL DEFAULT 0,
  "paymentStatus" TEXT        NOT NULL DEFAULT 'unpaid',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quotation_terms_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_terms_quotationId_fkey'
  ) THEN
    ALTER TABLE "quotation_terms"
      ADD CONSTRAINT "quotation_terms_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "quotation_terms_quotationId_idx" ON "quotation_terms"("quotationId");
