-- Three corrections to the MICE catalogue seeded in 20260923170000.
--
-- 1. Package names repeated the venue, which the Package MICE table already shows
--    in its own "Venue" column ("Meeting Package — Paramita Grand Ballroom —
--    Fullboard 12 Hours"). The name is now just the duration variant.
-- 2. "Ballroom Facilities" is the headline section of every quotation document and
--    must sort first; it was seeded at sortOrder 3, below Sound System/Seating.
-- 3. Booking fee per venue, read from the "Term & Payment" block of each venue's
--    most recent quotation in "RECAP DEALING MICE EVENT KEDIAMAN.xlsx".
--
-- Explicitly NOT done here: creating PaymentMethod rows. Bank accounts are shared
-- across venues (the same CV Cita Tenun Bangsa account settles Samisara, Grand
-- Slipi and Lippo quotations), and PaymentMethod.venueId pins a row to exactly one
-- venue — so seeding "the right account per venue" would mean inserting duplicate
-- rows of an account that already exists. Account selection stays a runtime choice
-- in the quotation drawer, which can already list accounts across venues.
--
-- Idempotent: every statement is a targeted UPDATE/INSERT guarded on its current
-- value, so re-running changes nothing.

-- ── 1. Drop the venue prefix from package names ──────────────────────────────
-- "Meeting Package — <Venue> — Fullday 8 Hours" → "Fullday 8 Hours"
-- "Venue Only — <Venue>"                       → "Venue Only"
UPDATE "packages"
SET "packageName" = regexp_replace("packageName", '^Meeting Package — .+ — ', ''),
    "updatedAt" = now()
WHERE "category" = 'MICE'
  AND "packageName" LIKE 'Meeting Package — % — %';

UPDATE "packages"
SET "packageName" = 'Venue Only',
    "updatedAt" = now()
WHERE "category" = 'MICE'
  AND "packageName" LIKE 'Venue Only — %';

-- ── 2. Pin "Ballroom Facilities" to the top of the item list ─────────────────
-- Shift the other inclusion rows down by one so the ordering becomes:
--   0 Ballroom Facilities → 1 Sound System → 2 Projector & LED → 3 Seating
--   → 4 Food & Beverage (already 4).
UPDATE "package_mice_items" i
SET "sortOrder" = 1, "updatedAt" = now()
FROM "packages" p
WHERE i."packageId" = p."id" AND p."category" = 'MICE'
  AND i."itemName" = 'Sound System' AND i."sortOrder" <> 1;

UPDATE "package_mice_items" i
SET "sortOrder" = 2, "updatedAt" = now()
FROM "packages" p
WHERE i."packageId" = p."id" AND p."category" = 'MICE'
  AND i."itemName" = 'Projector & LED' AND i."sortOrder" <> 2;

UPDATE "package_mice_items" i
SET "sortOrder" = 3, "updatedAt" = now()
FROM "packages" p
WHERE i."packageId" = p."id" AND p."category" = 'MICE'
  AND i."itemName" = 'Seating' AND i."sortOrder" <> 3;

UPDATE "package_mice_items" i
SET "sortOrder" = 0, "updatedAt" = now()
FROM "packages" p
WHERE i."packageId" = p."id" AND p."category" = 'MICE'
  AND i."itemName" = 'Ballroom Facilities' AND i."sortOrder" <> 0;

-- ── 3. Booking fee per venue on the quotation templates ──────────────────────
-- Rp 10jt everywhere except Grand Slipi, whose latest quotation reads
-- "Booking Fee of Rp 5,000,000 is required to confirm the reservation".
-- Paramita's most recent block is an Engagement package with no booking-fee line,
-- so it follows the Rp 10jt default used by the other venues.
INSERT INTO "quotation_templates" ("id", "venueId", "bookingFee", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v."id", s.booking_fee, now(), now()
FROM (VALUES
  ('SAMISARA', 10000000),
  ('BRIPENS',  10000000),
  ('LIPPO',    10000000),
  ('GP2',      10000000),
  ('GST',       5000000)
) AS s(venue_code, booking_fee)
JOIN "venues" v ON v."code" = s.venue_code
WHERE NOT EXISTS (
  SELECT 1 FROM "quotation_templates" qt WHERE qt."venueId" = v."id"
);

UPDATE "quotation_templates" qt
SET "bookingFee" = s.booking_fee, "updatedAt" = now()
FROM (VALUES
  ('SAMISARA', 10000000),
  ('BRIPENS',  10000000),
  ('LIPPO',    10000000),
  ('GP2',      10000000),
  ('GST',       5000000)
) AS s(venue_code, booking_fee)
JOIN "venues" v ON v."code" = s.venue_code
WHERE qt."venueId" = v."id"
  AND qt."bookingFee" IS DISTINCT FROM s.booking_fee;
