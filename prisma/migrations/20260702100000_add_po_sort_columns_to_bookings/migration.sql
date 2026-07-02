-- AlterTable: tambah kolom poYear dan poSeq untuk native DB sort
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "poYear" INTEGER;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "poSeq" INTEGER;

-- Backfill data dari poNumber existing (format: SEQ/BRAND/VENUE/TYPE/dd-mm-yyyy)
-- poSeq = segmen[0] (integer), poYear = tahun dari segmen[4] (bagian terakhir setelah '-')
UPDATE "bookings"
SET "poSeq" = NULLIF(split_part("poNumber", '/', 1), '')::INTEGER,
    "poYear" = NULLIF(split_part(split_part("poNumber", '/', 5), '-', 3), '')::INTEGER
WHERE "poNumber" IS NOT NULL
  AND array_length(string_to_array("poNumber", '/'), 1) = 5
  AND "poSeq" IS NULL;

-- CreateIndex: komposit index untuk sort & filter cepat
CREATE INDEX IF NOT EXISTS "bookings_recordStatus_poYear_poSeq_idx" ON "bookings"("recordStatus", "poYear", "poSeq");
