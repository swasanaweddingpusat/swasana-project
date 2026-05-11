-- ═══════════════════════════════════════════════════════════════════════
-- Sync All Changes (2026-05-09)
--
-- Catch-up migration for schema drift between 2026-05-01 and 2026-05-09.
-- Staging applied changes via `prisma db push`; this migration makes them
-- replayable on environments that use `prisma migrate deploy`.
--
-- All statements use IF EXISTS / IF NOT EXISTS / drop-before-add patterns
-- for full idempotency. Safe to run on:
--   • Fresh/older DB (prod — still at 20260427) → executes changes
--   • DB already in final state (staging via db:push) → no-op
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- STEP 1: Remove dependencies on enums we're about to drop
-- ───────────────────────────────────────────────────────────────────────

-- Convert bookings.weddingType from "WeddingType" enum → TEXT
-- (only runs if column is still an enum; staging already TEXT → no-op)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings'
          AND column_name = 'weddingType'
          AND udt_name = 'WeddingType'
    ) THEN
        ALTER TABLE "bookings"
            ALTER COLUMN "weddingType" TYPE TEXT USING "weddingType"::text;
    END IF;
END $$;

-- Drop user_venue_access table (removes dep on VenueAccessScope enum)
DROP TABLE IF EXISTS "user_venue_access";


-- ───────────────────────────────────────────────────────────────────────
-- STEP 2: Drop obsolete enums (now safe — no dependencies)
-- ───────────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS "VenueAccessScope";
DROP TYPE IF EXISTS "EventSession";    -- never used as column type
DROP TYPE IF EXISTS "WeddingType";


-- ───────────────────────────────────────────────────────────────────────
-- STEP 3: Create new tables
-- ───────────────────────────────────────────────────────────────────────

-- booking_revisions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "booking_revisions" (
    "id"             TEXT NOT NULL,
    "bookingId"      TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "reason"         TEXT,
    "packageId"      TEXT NOT NULL,
    "packageName"    TEXT NOT NULL,
    "variantId"      TEXT,
    "variantName"    TEXT,
    "variantPrice"   INTEGER NOT NULL DEFAULT 0,
    "venueId"        TEXT NOT NULL,
    "venueName"      TEXT NOT NULL,
    "discountName"   TEXT,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "snapshotData"   JSONB NOT NULL,
    "createdById"    TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_revisions_bookingId_revisionNumber_key"
    ON "booking_revisions"("bookingId", "revisionNumber");
CREATE INDEX IF NOT EXISTS "booking_revisions_bookingId_idx"
    ON "booking_revisions"("bookingId");
CREATE INDEX IF NOT EXISTS "booking_revisions_createdById_idx"
    ON "booking_revisions"("createdById");

ALTER TABLE "booking_revisions" DROP CONSTRAINT IF EXISTS "booking_revisions_bookingId_fkey";
ALTER TABLE "booking_revisions" ADD CONSTRAINT "booking_revisions_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_revisions" DROP CONSTRAINT IF EXISTS "booking_revisions_createdById_fkey";
ALTER TABLE "booking_revisions" ADD CONSTRAINT "booking_revisions_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- partial_payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "partial_payments" (
    "id"        TEXT NOT NULL,
    "termId"    TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,
    "paidAt"    TIMESTAMP(3) NOT NULL,
    "evidence"  TEXT,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partial_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partial_payments_termId_idx"
    ON "partial_payments"("termId");

ALTER TABLE "partial_payments" DROP CONSTRAINT IF EXISTS "partial_payments_termId_fkey";
ALTER TABLE "partial_payments" ADD CONSTRAINT "partial_payments_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "term_of_payments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


-- user_targets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_targets" (
    "id"        TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type"      TEXT NOT NULL DEFAULT 'sales',
    "amount"    BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3) NOT NULL,
    "setById"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_targets_profileId_idx"
    ON "user_targets"("profileId");
CREATE INDEX IF NOT EXISTS "user_targets_setById_idx"
    ON "user_targets"("setById");
CREATE INDEX IF NOT EXISTS "user_targets_type_startDate_endDate_idx"
    ON "user_targets"("type", "startDate", "endDate");

ALTER TABLE "user_targets" DROP CONSTRAINT IF EXISTS "user_targets_profileId_fkey";
ALTER TABLE "user_targets" ADD CONSTRAINT "user_targets_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_targets" DROP CONSTRAINT IF EXISTS "user_targets_setById_fkey";
ALTER TABLE "user_targets" ADD CONSTRAINT "user_targets_setById_fkey"
    FOREIGN KEY ("setById") REFERENCES "profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────────────────────────────────────────────────────────────────
-- STEP 4: Alter existing tables
-- ───────────────────────────────────────────────────────────────────────

-- profiles: add managerId + self-FK ────────────────────────────────────
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
CREATE INDEX IF NOT EXISTS "profiles_managerId_idx" ON "profiles"("managerId");
ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_managerId_fkey";
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;


-- bookings: add new columns, drop obsolete vendorComments ──────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "discountAmount"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "discountName"      TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "managerApprovedAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "managerSignature"  TEXT;
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "vendorComments";

-- bookings: add missing indexes
CREATE INDEX IF NOT EXISTS "bookings_packageVariantId_idx"
    ON "bookings"("packageVariantId");
CREATE INDEX IF NOT EXISTS "bookings_paymentMethodId_idx"
    ON "bookings"("paymentMethodId");
CREATE INDEX IF NOT EXISTS "bookings_sourceOfInformationId_idx"
    ON "bookings"("sourceOfInformationId");


-- customers: mobileNumber → JSONB, add sourceOfInformationId ───────────
-- Conditional type cast: only alters if column is not yet jsonb
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
          AND column_name = 'mobileNumber'
          AND data_type <> 'jsonb'
    ) THEN
        ALTER TABLE "customers"
            ALTER COLUMN "mobileNumber" TYPE JSONB USING "mobileNumber"::jsonb;
    END IF;
END $$;

ALTER TABLE "customers" ALTER COLUMN "mobileNumber" SET DEFAULT '[]'::jsonb;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sourceOfInformationId" TEXT;

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_sourceOfInformationId_fkey";
ALTER TABLE "customers" ADD CONSTRAINT "customers_sourceOfInformationId_fkey"
    FOREIGN KEY ("sourceOfInformationId") REFERENCES "source_of_informations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;


-- package_variants: add termAndCondition (moved from venues) ───────────
ALTER TABLE "package_variants" ADD COLUMN IF NOT EXISTS "termAndCondition" TEXT;


-- venues: drop termAndCondition (moved), add brandId index ─────────────
ALTER TABLE "venues" DROP COLUMN IF EXISTS "termAndCondition";
CREATE INDEX IF NOT EXISTS "venues_brandId_idx" ON "venues"("brandId");


-- snap_venues: drop extraHoursPrice ────────────────────────────────────
ALTER TABLE "snap_venues" DROP COLUMN IF EXISTS "extraHoursPrice";


-- approval_records: add updatedById ────────────────────────────────────
ALTER TABLE "approval_records" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
CREATE INDEX IF NOT EXISTS "approval_records_updatedById_idx"
    ON "approval_records"("updatedById");
ALTER TABLE "approval_records" DROP CONSTRAINT IF EXISTS "approval_records_updatedById_fkey";
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;


-- term_of_payments: unique invoiceNumber ───────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "term_of_payments_invoiceNumber_key"
    ON "term_of_payments"("invoiceNumber");


-- ───────────────────────────────────────────────────────────────────────
-- STEP 5: Add missing indexes across tables
-- ───────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "accounts_userId_idx"
    ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx"
    ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_profileId_idx"
    ON "email_verification_tokens"("profileId");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx"
    ON "password_reset_tokens"("userId");
CREATE INDEX IF NOT EXISTS "user_groups_leaderId_idx"
    ON "user_groups"("leaderId");
CREATE INDEX IF NOT EXISTS "approval_flow_steps_approverRoleId_idx"
    ON "approval_flow_steps"("approverRoleId");
CREATE INDEX IF NOT EXISTS "approval_flow_steps_approverUserId_idx"
    ON "approval_flow_steps"("approverUserId");
CREATE INDEX IF NOT EXISTS "approval_record_steps_approverRoleId_idx"
    ON "approval_record_steps"("approverRoleId");
CREATE INDEX IF NOT EXISTS "approval_record_steps_approverUserId_idx"
    ON "approval_record_steps"("approverUserId");
CREATE INDEX IF NOT EXISTS "approval_record_steps_decidedById_idx"
    ON "approval_record_steps"("decidedById");
CREATE INDEX IF NOT EXISTS "booking_comments_replyToId_idx"
    ON "booking_comments"("replyToId");
CREATE INDEX IF NOT EXISTS "booking_documents_uploadedBy_idx"
    ON "booking_documents"("uploadedBy");
CREATE INDEX IF NOT EXISTS "booking_payment_settlements_createdBy_idx"
    ON "booking_payment_settlements"("createdBy");
CREATE INDEX IF NOT EXISTS "booking_payment_settlements_paymentMethodId_idx"
    ON "booking_payment_settlements"("paymentMethodId");
CREATE INDEX IF NOT EXISTS "booking_payment_settlements_targetBookingId_idx"
    ON "booking_payment_settlements"("targetBookingId");
