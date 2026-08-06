-- Seed 9 MICE package templates (one representative quotation per venue).
-- Idempotent + venue-guarded: each package is inserted only if its venue
-- exists (by code) and no MICE package already references that venue. Items
-- are attached to the just-resolved package id. Missing venues are skipped,
-- never crash. Pricing (sellingPrice/categoryPrices) is intentionally left at
-- 0 — MICE 'Harga Jual' is set later via the Set Harga drawer.

-- MICE Package - Samisara (venue SAMISARA)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Samisara', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'SAMISARA'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Restroom
Parking area lot up to 800
Cleaning Service
Electricity 10.000 watt
Security', 'PAX'::"MiceItemPriceType", 450000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', 'Main Stage
Music Stage
200 Banquet Chairs
20 Roundtable D120 + Cover (Black)
4 Registration Table
LED Videotron 4x3
Soundsystem Standart 1000 Watt (2 Mic)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food and Beverages Full Day Package (1x Buffet, 2x Coffee Break)', 'Buffet Package Includes:
Nasi Putih
Ayam (Pilihan)
Daging (Pilihan)
Ikan (Pilihan)
Sayur (Pilihan)
Kerupuk
Sambal
Buah Potong
Air Mineral (Free Flow)
Lemon Tea/Lychee Tea
Coffee Break Package Includes:
Coffee
Tea
3 Snack Selections (Sweet & Savory)', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Complimentary', 'Free 3 Holding Room (Artia,Anggara,Ringkar)
Free VIP Room (Sortali & Tahuluk)
Free 250 Banquet Chairs
Free Cover Banquet Chairs
Free 30 IBM Table', 'NOMINAL'::"MiceItemPriceType", 0, 3, now(), now() FROM ins
;

-- MICE Package - Menara Bripens (venue BRIPENS)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Menara Bripens', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'BRIPENS'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Menara Bripens Grand Ballroom for 6 hours
Full Carpet Ballroom
Full Air Conditioned
Exclusive Chandeliers
8-meter High Ceiling
2 Changing Rooms
1 Holding Room
Exclusive Restroom
Prayer Room
Parking area lot up to 800
Cleaning Service
Electricity 10.000 watt
Security', 'PAX'::"MiceItemPriceType", 575000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', 'Main Stage
Music Stage
100 Tiffany Chairs
20 Roundtable D120 + Cover (Black)
4 Registration Table + Cover (Black)
LED Videotron 2,5 x 5 m
Soundsystem Standart (2 Mic)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food and Beverages', '1x Buffet
1x Coffee Break', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
;

-- MICE Package - Patrajasa (venue PTR)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Patrajasa', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'PTR'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Patrajasa Yudistira Grand Ballroom usage for 8 hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Chandeliers
7-meter High Ceiling
3 Changing Rooms
Exclusive Restroom
Parking area lot up to 600
Cleaning Service
Electricity 10.000 watt
Security', 'NOMINAL'::"MiceItemPriceType", 65000000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', 'Main Stage
240 Mix Banquet & Futura Chairs
4 Registration Table (d120)
LED Videotron
Soundsystem Standart (2 MIC)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food & Beverage Inclusions', 'Buffet Meals
Coffee Break Sessions', 'PAX'::"MiceItemPriceType", 325000, 2, now(), now() FROM ins
;

-- MICE Package - Lippo Kuningan (venue LIPPO)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Lippo Kuningan', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'LIPPO'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Ballroom usage for 6 hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Chandeliers
1 Holding Rooms
2 Changing Rooms
Parking area up to 600 cars
Electricity 10.000 watt
Security
Cleaning Service', 'PAX'::"MiceItemPriceType", 350000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', '200 Chairs (non-cover)
Roundtables (d120)
4 Registration Table
LED Videotron
Soundsystem Standart (2 MIC)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food & Beverage', '(1) Buffet Meals
(1) Coffee Break for Takjil', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Complimentary', '400 Chairs (non cover)', 'NOMINAL'::"MiceItemPriceType", 0, 3, now(), now() FROM ins
;

-- MICE Package - Graha Paramita (venue GP2)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Graha Paramita', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'GP2'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Graha Paramita II Grand Ballroom usage for 6 hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Chandeliers
7-meter High Ceiling
Exclusive Restroom
Prayer Room
Parking area 350 cars
Cleaning Service
Electricity 10.000 watt
Security', 'PAX'::"MiceItemPriceType", 350000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', '100 Tiffany Chairs
20 Roundtables (d120)
2 Registration Table (d120)
LED Videotron
Soundsystem Standart (2 MIC)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food & Beverage Inclusions', '(1) Buffet Meals
(1) Coffee Break', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Complimentary', '20 Tiffany Chairs', 'NOMINAL'::"MiceItemPriceType", 0, 3, now(), now() FROM ins
;

-- MICE Package - Grand Slipi (venue GST)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Grand Slipi', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'GST'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Grand Slipi Convention Hall usage for 8hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Chandeliers
7-meter High Ceiling
1 Multifunction Rooms
2 Changing Rooms
Parking area up to 600 cars
Electricity 10.000 watt
Security
Cleaning Service', 'PAX'::"MiceItemPriceType", 375000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', '100 Chairs (non cover)
20 Roundtables (d120)
2 Registration Table (d120)
LED Videotron
Soundsystem Standart (2 MIC)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food & Beverage Inclusions : (by Safura)', 'Buffet Meals 1x
Coffee Break 1x', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Complimentary', 'Round Tables + Black Cover
Chairs (non Covers)', 'NOMINAL'::"MiceItemPriceType", 0, 3, now(), now() FROM ins
;

-- MICE Package - BRIN Thamrin (venue TAMRIN)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - BRIN Thamrin', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'TAMRIN'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'BRIN Thamrin Grand Ballroom usage for 8hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
12-meter High Ceiling
2 Changing Rooms
Exclusive Restroom
Prayer Room
Parking area lot up to 800
Cleaning Service
Electricity 10.000 watt
Security', 'NOMINAL'::"MiceItemPriceType", 65000000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', 'Main Stage
100 Chairs Futura 300 Kursi Hijau
600 Chairs on Tribun Area
Registration Table', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Complimentary', 'VIP Room
Sofa VIP di Ruang VIP
Free Corkage Fee', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
;

-- MICE Package - BRIN Gatot Subroto (venue BRIN)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - BRIN Gatot Subroto', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'BRIN'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'BRIN Gatot Subroto Grand Ballroom usage for 6hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Chandeliers
5-meter High Ceiling
2 Changing Rooms
Exclusive Restroom
Prayer Room
Parking area lot up to 500
Cleaning Service
Electricity 10.000 watt
Security', 'PAX'::"MiceItemPriceType", 250000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', 'Main Stage
100 Futura Chairs
20 Roundtables (d120)
5 Registration Table (d120)
LED Videotron 4x3
Soundsystem Standart (2 MIC)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food & Beverage Inclusions', 'Buffet Meals
Takjil', 'NOMINAL'::"MiceItemPriceType", 0, 2, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Complimentary', '100 Kursi Futura + Cover Hitam
15 Meja Roundtable', 'NOMINAL'::"MiceItemPriceType", 0, 3, now(), now() FROM ins
;

-- MICE Package - Dharmagati (venue DRM)
WITH ins AS (
  INSERT INTO "packages" (
    "id", "packageName", "category", "available", "approvalStatus",
    "venueId", "notes", "pax", "margin", "sellingPrice", "termAndCondition",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), 'MICE Package - Dharmagati', 'MICE'::"EventCategory", true, 'approved',
    v."id", '', 0, 50, 0, NULL,
    now(), now()
  FROM "venues" v
  WHERE v."code" = 'DRM'
    AND NOT EXISTS (
      SELECT 1 FROM "packages" p
      WHERE p."category" = 'MICE'::"EventCategory" AND p."venueId" = v."id"
    )
  LIMIT 1
  RETURNING "id"
)
INSERT INTO "package_mice_items" (
  "id", "packageId", "itemName", "itemDescription", "itemType", "itemPrice", "sortOrder", "createdAt", "updatedAt"
)
  SELECT gen_random_uuid(), ins."id", 'Ballroom Facilities', 'Swasana Dharmagati Grand Ballroom usage for 6hrs
Full Carpet Ballroom
Full Air Conditioned
Voyager Area
Exclusive Chandeliers
7-meter High Ceiling
2 Changing Rooms
Exclusive Restroom
Parking area lot up to 500
Cleaning Service
Electricity 10.000 watt
Security', 'NOMINAL'::"MiceItemPriceType", 25000000, 0, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Equipments', 'Main Stage
100 Chairs
20 Roundtables (d120)
Registration Table (d120)
Soundsystem Standart (2 MIC)', 'NOMINAL'::"MiceItemPriceType", 0, 1, now(), now() FROM ins
  UNION ALL
  SELECT gen_random_uuid(), ins."id", 'Food & Beverage Inclusions', 'Buffet Meals (1x)
Coffee Break (1x)', 'PAX'::"MiceItemPriceType", 220000, 2, now(), now() FROM ins
;
