-- Reseed Package MICE from two sources:
--   1. "BOOKLATE MICE EVENT" booklet  → 15 per-pax Meeting Packages (5 venues x 3 durations)
--   2. "RECAP DEALING MICE EVENT KEDIAMAN.xlsx", latest quotations (Sep–Oct 2026)
--      → 5 flat-rate "Venue Only" packages, plus the Security Deposit line.
--
-- Why both: the booklet is the published per-pax price list, but the quotations
-- actually being closed in the field are overwhelmingly venue-rental deals
-- ("Venue Only" / "Venue + F&B") priced as a flat ballroom fee. Sales needs both
-- shapes available in the quotation package picker.
--
-- The 9 legacy MICE packages are dropped: 7 had zero PackageMicePrice rows (so
-- they never appeared in the picker at all), every one had pax = 0 despite the
-- booklet's 100-pax minimum, and most had no eventTypeId, making
-- Halfday/Fullday/Fullboard indistinguishable.
--
-- Tax & deposit: the recap sheets are explicit that quoted prices are net —
-- "The prices stated are net and it does not include income tax (PPh)" and
-- "*Tax is not included from the total price". So NO PPN/PB1 row is seeded. The
-- only recurring charge is a flat Rp 5.000.000 refundable Security Deposit,
-- which appears in every recent quotation across Samisara, BRIPens, Slipi and
-- Lippo; it is seeded onto all packages.
--
-- Booking fee differs per venue (Samisara/BRIPens/Lippo Rp 10jt, Grand Slipi
-- Rp 5jt). That lives on QuotationTemplate.bookingFee, not on Package, so it is
-- backfilled onto the existing per-venue templates below.
--
-- Safety notes:
--   * bookings.packageId is ON DELETE RESTRICT. Verified at authoring time: no
--     booking references a MICE package. The guard below aborts loudly if that
--     ever changes, rather than failing halfway through.
--   * quotations.packageId is ON DELETE SET NULL, and one legacy quotation
--     ("001/WED/2026") points at a MICE package. Its packageId/packageName are
--     cleared, but its frozen SnapQuotationPackage rows are left untouched, so
--     the rendered quotation document keeps its package data intact.
--   * package_mice_items / package_mice_prices / package_mice_tax_deposits /
--     package_complimentaries / package_bonuses all cascade from packages.
--
-- Idempotent: the delete is scoped to category = 'MICE', and every insert is
-- guarded by WHERE NOT EXISTS, so re-running this migration is a no-op.

-- ── 1. Refuse to run if a booking would be orphaned ──────────────────────────
DO $$
DECLARE
  blocking_bookings INT;
BEGIN
  SELECT COUNT(*) INTO blocking_bookings
  FROM "bookings" b
  JOIN "packages" p ON p."id" = b."packageId"
  WHERE p."category" = 'MICE';

  IF blocking_bookings > 0 THEN
    RAISE EXCEPTION
      'Aborting: % booking(s) still reference a MICE package. Reassign them before reseeding.',
      blocking_bookings;
  END IF;
END
$$;

-- ── 2. Drop the legacy MICE catalogue ────────────────────────────────────────
-- Children cascade; quotations.packageId is SET NULL by the FK. packageName is a
-- denormalized copy with no FK, so it is cleared explicitly to avoid leaving a
-- dangling name that no longer resolves to a package.
UPDATE "quotations" q
SET "packageName" = NULL
WHERE q."packageId" IN (SELECT "id" FROM "packages" WHERE "category" = 'MICE');

DELETE FROM "packages" WHERE "category" = 'MICE';

-- ── 3. Meeting Packages (per-pax, from the booklet) ──────────────────────────
-- pax = 100 encodes the booklet's "*min order 100 pax" rule.
-- approvalStatus = 'approved' matches how the app treats MICE packages (they
-- have no approval flow); available = true so they are immediately sellable.
INSERT INTO "packages" (
  "id", "packageName", "category", "eventTypeId", "available", "approvalStatus",
  "venueId", "pax", "margin", "sellingPrice", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), s.package_name, 'MICE', et."id", true, 'approved',
  v."id", 100, 0, 0, now(), now()
FROM (VALUES
  ('SAMISARA', 'H6',   'Meeting Package — Samisara Sopodel Grand Ballroom — Halfday 6 Hours'),
  ('SAMISARA', 'FM8',  'Meeting Package — Samisara Sopodel Grand Ballroom — Fullday 8 Hours'),
  ('SAMISARA', 'FM12', 'Meeting Package — Samisara Sopodel Grand Ballroom — Fullboard 12 Hours'),
  ('BRIPENS',  'H6',   'Meeting Package — Menara BRIPens Grand Ballroom — Halfday 6 Hours'),
  ('BRIPENS',  'FM8',  'Meeting Package — Menara BRIPens Grand Ballroom — Fullday 8 Hours'),
  ('BRIPENS',  'FM12', 'Meeting Package — Menara BRIPens Grand Ballroom — Fullboard 12 Hours'),
  ('GST',      'H6',   'Meeting Package — Grand Slipi Convention Hall — Halfday 6 Hours'),
  ('GST',      'FM8',  'Meeting Package — Grand Slipi Convention Hall — Fullday 8 Hours'),
  ('GST',      'FM12', 'Meeting Package — Grand Slipi Convention Hall — Fullboard 12 Hours'),
  ('LIPPO',    'H6',   'Meeting Package — Lippo Kuningan Grand Ballroom — Halfday 6 Hours'),
  ('LIPPO',    'FM8',  'Meeting Package — Lippo Kuningan Grand Ballroom — Fullday 8 Hours'),
  ('LIPPO',    'FM12', 'Meeting Package — Lippo Kuningan Grand Ballroom — Fullboard 12 Hours'),
  ('GP2',      'H6',   'Meeting Package — Paramita Grand Ballroom — Halfday 6 Hours'),
  ('GP2',      'FM8',  'Meeting Package — Paramita Grand Ballroom — Fullday 8 Hours'),
  ('GP2',      'FM12', 'Meeting Package — Paramita Grand Ballroom — Fullboard 12 Hours')
) AS s(venue_code, event_type_code, package_name)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "event_types" et ON et."code" = s.event_type_code AND et."category" = 'MICE'
WHERE NOT EXISTS (
  SELECT 1 FROM "packages" p
  WHERE p."packageName" = s.package_name AND p."venueId" = v."id"
);

-- ── 4. Venue Only packages (flat ballroom rental) ────────────────────────────
-- Rates come from the "Swasana Venue Mastery" pages of the booklet. An eventType
-- IS assigned even though these are venue-only: getMicePackagesForQuotation()
-- filters by eventTypeId, so a null would make them invisible in the picker.
-- Halfday (H6) is used as the baseline duration, matching how the recent
-- Grand Slipi and Samisara venue-only quotations were written.
INSERT INTO "packages" (
  "id", "packageName", "category", "eventTypeId", "available", "approvalStatus",
  "venueId", "pax", "margin", "sellingPrice", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), s.package_name, 'MICE', et."id", true, 'approved',
  v."id", 0, 0, 0, now(), now()
FROM (VALUES
  ('SAMISARA', 'H6', 'Venue Only — Samisara Sopodel Grand Ballroom'),
  ('BRIPENS',  'H6', 'Venue Only — Menara BRIPens Grand Ballroom'),
  ('GST',      'H6', 'Venue Only — Grand Slipi Convention Hall'),
  ('LIPPO',    'H6', 'Venue Only — Lippo Kuningan Grand Ballroom'),
  ('GP2',      'H6', 'Venue Only — Paramita Grand Ballroom')
) AS s(venue_code, event_type_code, package_name)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "event_types" et ON et."code" = s.event_type_code AND et."category" = 'MICE'
WHERE NOT EXISTS (
  SELECT 1 FROM "packages" p
  WHERE p."packageName" = s.package_name AND p."venueId" = v."id"
);

-- ── 5. Inclusion items, shared by every package of a venue ───────────────────
-- Sound system / projector / videotron / seating differ per venue; the booklet
-- lists them once per venue page.
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "sortOrder", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", s.item_name, s.item_description, s.sort_order, now(), now()
FROM (VALUES
  ('SAMISARA', 'Sound System',    'Standard Sound System',                            0),
  ('SAMISARA', 'Projector & LED', '1 Unit Projector dan LED Videotron 3x4 M',         1),
  ('SAMISARA', 'Seating',         '20 Roundtables & 100 Tiffany Chairs',              2),
  ('BRIPENS',  'Sound System',    'Standard Sound System',                            0),
  ('BRIPENS',  'Projector & LED', '1 Unit Projector dan LED Videotron 2.88 x 5.12 M', 1),
  ('BRIPENS',  'Seating',         '20 Roundtables & 100 Tiffany Chairs',              2),
  ('GST',      'Sound System',    'Standard Sound System',                            0),
  ('GST',      'Projector & LED', '1 LED Videotron 3x4 M',                            1),
  ('GST',      'Seating',         '20 Roundtables & 100 Banquet Chairs',              2),
  ('LIPPO',    'Sound System',    'Standard Sound System',                            0),
  ('LIPPO',    'Projector & LED', '1 LED Videotron 2x3 M',                            1),
  ('LIPPO',    'Seating',         '20 Roundtables & 100 Banquet Chairs',              2),
  ('GP2',      'Sound System',    'Standard Sound System',                            0),
  ('GP2',      'Projector & LED', '1 LED Videotron 2x3 M',                            1),
  ('GP2',      'Seating',         '20 Roundtables & 100 Banquet Chairs',              2)
) AS s(venue_code, item_name, item_description, sort_order)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "packages" p ON p."venueId" = v."id" AND p."category" = 'MICE'
WHERE NOT EXISTS (
  SELECT 1 FROM "package_mice_items" i
  WHERE i."packageId" = p."id" AND i."itemName" = s.item_name
);

-- ── 6. Ballroom facilities blurb, per venue ──────────────────────────────────
-- Condensed from the "A. Ballroom Facilities" section of the most recent
-- quotation for each venue in the recap workbook.
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "sortOrder", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", 'Ballroom Facilities', s.item_description, 3, now(), now()
FROM (VALUES
  ('SAMISARA', E'Full Carpet Ballroom\nFull Air Conditioned\nVoyager Area\n5-meter High Ceiling\n2 Changing Rooms\nExclusive Restroom\nParking area lot up to 800\nCleaning Service\nElectricity 10.000 watt\nSecurity\nMain Stage'),
  ('BRIPENS',  E'Full Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n1 Holding Room\n2 Changing Rooms\nParking area up to 600 cars\nElectricity 10.000 watt\nSecurity\nCleaning Service'),
  ('GST',      E'Full Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n7-meter High Ceiling\n1 Holding Room\n2 Changing Rooms\nParking area up to 600 cars\nElectricity 10.000 watt\nSecurity\nCleaning Service'),
  ('LIPPO',    E'Full Carpet Ballroom\nFull Air Conditioned\nVoyager Area\n5-meter High Ceiling\n2 Changing Rooms\nExclusive Restroom\nParking area lot up to 800\nCleaning Service\nElectricity 10.000 watt\nSecurity\nMain Stage'),
  ('GP2',      E'Full Carpet Ballroom\nFull Air Conditioned\n2 Changing Rooms\nExclusive Restroom\nParking area lot up to 800\nCleaning Service\nElectricity 10.000 watt\nSecurity\nMain Stage')
) AS s(venue_code, item_description)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "packages" p ON p."venueId" = v."id" AND p."category" = 'MICE'
WHERE NOT EXISTS (
  SELECT 1 FROM "package_mice_items" i
  WHERE i."packageId" = p."id" AND i."itemName" = 'Ballroom Facilities'
);

-- ── 7. Food & beverage item — Meeting Packages only, varies by duration ──────
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "sortOrder", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", 'Food & Beverage', s.item_description, 4, now(), now()
FROM (VALUES
  ('H6',   '1x Coffee Break | 1x Buffet Meal'),
  ('FM8',  '2x Coffee Break | 1x Buffet Meal'),
  ('FM12', '2x Coffee Break | 2x Buffet Meal')
) AS s(event_type_code, item_description)
JOIN "event_types" et ON et."code" = s.event_type_code AND et."category" = 'MICE'
JOIN "packages" p
  ON p."eventTypeId" = et."id"
 AND p."category" = 'MICE'
 AND p."packageName" LIKE 'Meeting Package%'
WHERE NOT EXISTS (
  SELECT 1 FROM "package_mice_items" i
  WHERE i."packageId" = p."id" AND i."itemName" = 'Food & Beverage'
);

-- ── 8. Meeting Package pricing (per pax) ─────────────────────────────────────
-- priceType QTY: qty = 100 pax (booklet minimum), price = per-pax rate,
-- total = qty * price — matching how the "Harga" step computes MICE totals.
INSERT INTO "package_mice_prices" (
  "id", "packageId", "name", "description", "priceType", "qty", "price", "total",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), p."id", 'Meeting Package', s.price_description,
  'QTY', 100, s.price_per_pax, 100 * s.price_per_pax, 0, now(), now()
FROM (VALUES
  ('SAMISARA', 'H6',   660000, 'Halfday Package (6 Hours) — IDR 660.000 /pax'),
  ('SAMISARA', 'FM8',  725000, 'Fullday Package (8 Hours) — IDR 725.000 /pax'),
  ('SAMISARA', 'FM12', 785000, 'Fullboard Package (12 Hours) — IDR 785.000 /pax'),
  ('BRIPENS',  'H6',   575000, 'Halfday Package (6 Hours) — IDR 575.000 /pax'),
  ('BRIPENS',  'FM8',  595000, 'Fullday Package (8 Hours) — IDR 595.000 /pax'),
  ('BRIPENS',  'FM12', 615000, 'Fullboard Package (12 Hours) — IDR 615.000 /pax'),
  ('GST',      'H6',   385000, 'Halfday Package (6 Hours) — IDR 385.000 /pax'),
  ('GST',      'FM8',  425000, 'Fullday Package (8 Hours) — IDR 425.000 /pax'),
  ('GST',      'FM12', 465000, 'Fullboard Package (12 Hours) — IDR 465.000 /pax'),
  ('LIPPO',    'H6',   385000, 'Halfday Package (6 Hours) — IDR 385.000 /pax'),
  ('LIPPO',    'FM8',  425000, 'Fullday Package (8 Hours) — IDR 425.000 /pax'),
  ('LIPPO',    'FM12', 465000, 'Fullboard Package (12 Hours) — IDR 465.000 /pax'),
  ('GP2',      'H6',   335000, 'Halfday Package (6 Hours) — IDR 335.000 /pax'),
  ('GP2',      'FM8',  385000, 'Fullday Package (8 Hours) — IDR 385.000 /pax'),
  ('GP2',      'FM12', 425000, 'Fullboard Package (12 Hours) — IDR 425.000 /pax')
) AS s(venue_code, event_type_code, price_per_pax, price_description)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "event_types" et ON et."code" = s.event_type_code AND et."category" = 'MICE'
JOIN "packages" p
  ON p."venueId" = v."id"
 AND p."eventTypeId" = et."id"
 AND p."category" = 'MICE'
 AND p."packageName" LIKE 'Meeting Package%'
WHERE NOT EXISTS (
  SELECT 1 FROM "package_mice_prices" mp
  WHERE mp."packageId" = p."id" AND mp."name" = 'Meeting Package'
);

-- ── 9. Venue Only pricing (flat ballroom rental) ─────────────────────────────
-- priceType NOMINAL: a flat total with no qty/price breakdown, which is exactly
-- how the recent venue-rental quotations are written.
INSERT INTO "package_mice_prices" (
  "id", "packageId", "name", "description", "priceType", "qty", "price", "total",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), p."id", 'Ballroom Rental', s.price_description,
  'NOMINAL', NULL, NULL, s.rental_price, 0, now(), now()
FROM (VALUES
  ('SAMISARA', 85000000, 'Sewa Ballroom — IDR 85.000.000'),
  ('BRIPENS',  40000000, 'Sewa Ballroom — IDR 40.000.000'),
  ('GST',      45000000, 'Sewa Ballroom — IDR 45.000.000'),
  ('LIPPO',    45000000, 'Sewa Ballroom — IDR 45.000.000'),
  ('GP2',      35000000, 'Sewa Ballroom — IDR 35.000.000')
) AS s(venue_code, rental_price, price_description)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "packages" p
  ON p."venueId" = v."id"
 AND p."category" = 'MICE'
 AND p."packageName" LIKE 'Venue Only%'
WHERE NOT EXISTS (
  SELECT 1 FROM "package_mice_prices" mp
  WHERE mp."packageId" = p."id" AND mp."name" = 'Ballroom Rental'
);

-- ── 10. Holding room, where the booklet offers one ───────────────────────────
INSERT INTO "package_mice_prices" (
  "id", "packageId", "name", "description", "priceType", "qty", "price", "total",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), p."id", 'Holding Room', 'Sewa Holding Room — IDR 15.000.000',
  'NOMINAL', NULL, NULL, 15000000, 1, now(), now()
FROM (VALUES ('SAMISARA'), ('GP2')) AS s(venue_code)
JOIN "venues" v ON v."code" = s.venue_code
JOIN "packages" p
  ON p."venueId" = v."id"
 AND p."category" = 'MICE'
 AND p."packageName" LIKE 'Venue Only%'
WHERE NOT EXISTS (
  SELECT 1 FROM "package_mice_prices" mp
  WHERE mp."packageId" = p."id" AND mp."name" = 'Holding Room'
);

-- ── 11. Security Deposit on every MICE package ───────────────────────────────
-- Flat Rp 5.000.000, refundable within 3 days post-event absent damage. Present
-- in every recent quotation across Samisara, BRIPens, Grand Slipi and Lippo.
INSERT INTO "package_mice_tax_deposits" (
  "id", "packageId", "name", "nominal", "sortOrder", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", 'Security Deposit', 5000000, 0, now(), now()
FROM "packages" p
WHERE p."category" = 'MICE'
  AND NOT EXISTS (
    SELECT 1 FROM "package_mice_tax_deposits" td
    WHERE td."packageId" = p."id" AND td."name" = 'Security Deposit'
  );

-- ── 12. Booking fee per venue on the quotation templates ─────────────────────
-- Rp 10jt for Samisara / BRIPens / Lippo, Rp 5jt for Grand Slipi, per the
-- "Booking Fee of Rp X is required to confirm the reservation" line in each
-- venue's latest quotation. Only fills templates that have no fee set yet.
UPDATE "quotation_templates" qt
SET "bookingFee" = s.booking_fee, "updatedAt" = now()
FROM (VALUES
  ('SAMISARA', 10000000),
  ('BRIPENS',  10000000),
  ('LIPPO',    10000000),
  ('GST',       5000000)
) AS s(venue_code, booking_fee)
JOIN "venues" v ON v."code" = s.venue_code
WHERE qt."venueId" = v."id"
  AND qt."bookingFee" IS NULL;
