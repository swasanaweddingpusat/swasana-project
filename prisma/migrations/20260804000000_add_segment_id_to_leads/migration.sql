-- Normalisasi MICE segment: dari free-text "leads"."instansi" ke FK "leads"."segmentId" → "lead_segments".
-- Kolom "instansi" SENGAJA dipertahankan sebagai fallback baca sampai di-drop di migration terpisah.
-- Idempotent: aman dijalankan berulang.

-- 1) Tambah kolom segmentId
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "segmentId" TEXT;

-- 2) Index untuk filter/lookup per segment
CREATE INDEX IF NOT EXISTS "leads_segmentId_idx" ON "leads"("segmentId");

-- 3) Foreign key (drop dulu biar idempotent)
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_segmentId_fkey";
ALTER TABLE "leads" ADD CONSTRAINT "leads_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "lead_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Backfill master: insert nilai instansi yang belum ada di lead_segments.
--    Guard NOT EXISTS per nama (name bukan unique) — aman diulang, tanpa duplikat.
--    Trim + buang string kosong. sortOrder ditaruh di belakang master existing.
INSERT INTO "lead_segments" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), src.name, true,
       COALESCE((SELECT MAX("sortOrder") FROM "lead_segments"), 0) + 100, now(), now()
FROM (
  SELECT DISTINCT btrim("instansi") AS name
  FROM "leads"
  WHERE "instansi" IS NOT NULL AND btrim("instansi") <> ''
) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM "lead_segments" ls WHERE ls."name" = src.name
);

-- 5) Backfill link: set leads.segmentId dari name match (case-sensitive, trim).
--    Kalau ada >1 segment dengan nama sama, ambil yang createdAt paling awal (deterministik).
UPDATE "leads" l
SET "segmentId" = ls."id"
FROM (
  SELECT DISTINCT ON ("name") "id", "name"
  FROM "lead_segments"
  ORDER BY "name", "createdAt" ASC
) ls
WHERE l."segmentId" IS NULL
  AND l."instansi" IS NOT NULL
  AND btrim(l."instansi") = ls."name";
