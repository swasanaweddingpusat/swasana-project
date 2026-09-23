-- Make Quotation a standalone document.
--
-- Intent: a quotation looks master data up ONCE, at create/edit time, then freezes
-- everything it needs — venueName / eventTypeName / packageName as plain strings,
-- and the full package contents into snap_quotation_packages + its child tables.
-- After that the document must never depend on master data again: renaming,
-- repricing or deleting a venue / event type / payment method / package must not
-- alter or break an already-issued quotation.
--
-- The foreign keys on venueId / eventTypeId / paymentMethodId contradicted that:
-- they forced the database to keep resolving those pointers, and a master delete
-- would silently rewrite an issued document's columns to NULL.
--
-- The ID columns are KEPT (and indexed) — they remain useful as provenance for
-- analytics ("which venue produced the most quotations"). They are simply allowed
-- to dangle once the master row is gone. Display values never read them; they read
-- the frozen strings and the snapshot.
--
-- Deliberately NOT detached:
--   * quotations.salesId → profiles (RESTRICT). Not master data; it is the person
--     accountable for the document. Losing that breaks the audit trail.
--   * bookings.quotationId → quotations (RESTRICT). Evidence of which quotation a
--     booking was converted from; must stay referentially intact.
--
-- packageId already had no FK, so it needs no change here — this migration brings
-- the other three pointers in line with it.

-- ── 1. Drop the three master-data foreign keys ───────────────────────────────
-- Indexes on these columns are created separately by Prisma and are left in place,
-- so filtering/grouping by venue or event type stays fast.
ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_venueId_fkey";
ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_eventTypeId_fkey";
ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_paymentMethodId_fkey";

-- ── 2. Freeze the bank details the document renders ──────────────────────────
-- The Term & Payment block used to render bankName / account number / recipient
-- by joining PaymentMethod live, so editing a venue's bank account silently
-- rewrote every quotation ever issued against it. These are now frozen at
-- create/edit time, exactly like venueName and eventTypeName.
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "bankRecipient" TEXT;

UPDATE "quotations" q
SET "bankName" = pm."bankName",
    "bankAccountNumber" = pm."bankAccountNumber",
    "bankRecipient" = pm."bankRecipient"
FROM "payment_methods" pm
WHERE q."paymentMethodId" = pm."id"
  AND q."bankName" IS NULL;

-- ── 3. Backfill frozen display names for any pre-existing rows ───────────────
-- Older quotations may have been saved with a null venueName / eventTypeName,
-- relying on the JOIN to render. With the FKs gone that fallback is no longer
-- guaranteed, so the names are materialised now while the masters still resolve.
UPDATE "quotations" q
SET "venueName" = v."name"
FROM "venues" v
WHERE q."venueId" = v."id"
  AND q."venueName" IS NULL;

UPDATE "quotations" q
SET "eventTypeName" = et."name"
FROM "event_types" et
WHERE q."eventTypeId" = et."id"
  AND q."eventTypeName" IS NULL;

-- ── 4. Backfill the package name from the frozen snapshot ────────────────────
-- Reseeding the MICE catalogue cleared packageName on one legacy quotation while
-- leaving its packageId pointing at a now-deleted package. The authoritative value
-- still lives in the snapshot, so it is restored from there.
UPDATE "quotations" q
SET "packageName" = sp."packageName"
FROM "snap_quotation_packages" sp
WHERE sp."quotationId" = q."id"
  AND q."packageName" IS NULL
  AND sp."packageName" <> '';

-- ── 5. Backfill the Grand Slipi booking fee ──────────────────────────────────
-- The previous migration set this per venue via UPDATE, but Grand Slipi has no
-- quotation_templates row yet, so it matched nothing. Its latest quotation states
-- "Booking Fee of Rp 5,000,000 is required to confirm the reservation".
INSERT INTO "quotation_templates" ("id", "venueId", "bookingFee", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v."id", 5000000, now(), now()
FROM "venues" v
WHERE v."code" = 'GST'
  AND NOT EXISTS (
    SELECT 1 FROM "quotation_templates" qt WHERE qt."venueId" = v."id"
  );

UPDATE "quotation_templates" qt
SET "bookingFee" = 5000000, "updatedAt" = now()
FROM "venues" v
WHERE qt."venueId" = v."id"
  AND v."code" = 'GST'
  AND qt."bookingFee" IS NULL;
