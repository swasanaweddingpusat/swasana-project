-- Global Category master + link package category-prices & vendor-items by id.
-- Replaces fragile string (categoryName) matching for takeout with FK by category.
-- Idempotent.

-- ── 1. Category table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "categories" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_key" ON "categories"("name");

-- ── 2. Add FK columns ─────────────────────────────────────────────────────────
ALTER TABLE "package_category_prices" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "package_vendor_items"    ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "snap_package_vendor_items" ADD COLUMN IF NOT EXISTS "isTakeout" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "package_category_prices_categoryId_idx" ON "package_category_prices"("categoryId");
CREATE INDEX IF NOT EXISTS "package_vendor_items_categoryId_idx" ON "package_vendor_items"("categoryId");

DO $$ BEGIN
  ALTER TABLE "package_category_prices"
    ADD CONSTRAINT "package_category_prices_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "package_vendor_items"
    ADD CONSTRAINT "package_vendor_items_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Seed 23 canonical categories ───────────────────────────────────────────
INSERT INTO "categories" ("id","name","sortOrder","createdAt","updatedAt")
SELECT gen_random_uuid(), c.name, c.ord, now(), now()
FROM (VALUES
  ('Catering', 1),
  ('Dekorasi', 2),
  ('Rias Busana', 3),
  ('Photography', 4),
  ('Entertainment', 5),
  ('MC', 6),
  ('WO', 7),
  ('RAB Event', 8),
  ('Bonus Sales', 9),
  ('Bonus Manager', 10),
  ('Bonus Direktur', 11),
  ('Bonus Venue Specialist', 12),
  ('Discount Client', 13),
  ('Gedung (min 70 event/thn)', 14),
  ('LED Videotron', 15),
  ('Hotel / Wisma', 16),
  ('Digital Invitation & Guest Book', 17),
  ('Usher', 18),
  ('Izin Kepolisian', 19),
  ('Adat', 20),
  ('Lighting Ambiance / Efect Dry Ice', 21),
  ('Wedding Content Creator', 22),
  ('Siraman', 23)
) AS c(name, ord)
ON CONFLICT ("name") DO NOTHING;

-- ── 4. Backfill categoryId via normalized name match (one-time) ────────────────
-- Normalize: upper, strip '&', collapse whitespace. Mirrors the Fase 0 analysis.
UPDATE "package_category_prices" p
SET "categoryId" = c.id
FROM "categories" c
WHERE p."categoryId" IS NULL
  AND regexp_replace(regexp_replace(upper(trim(p."categoryName")), '&', ' ', 'g'), '\s+', ' ', 'g')
    = regexp_replace(regexp_replace(upper(trim(c."name")), '&', ' ', 'g'), '\s+', ' ', 'g');

UPDATE "package_vendor_items" p
SET "categoryId" = c.id
FROM "categories" c
WHERE p."categoryId" IS NULL
  AND regexp_replace(regexp_replace(upper(trim(p."categoryName")), '&', ' ', 'g'), '\s+', ' ', 'g')
    = regexp_replace(regexp_replace(upper(trim(c."name")), '&', ' ', 'g'), '\s+', ' ', 'g');
