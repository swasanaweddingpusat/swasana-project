-- Reconcile legacy free-text quotation references before enforcing the relation.
UPDATE "bookings" AS b
SET "quotationId" = NULL
WHERE b."quotationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "quotations" AS q WHERE q."id" = b."quotationId"
  );

-- A quotation can produce at most one booking. Keep the oldest existing link and
-- detach later duplicates so this migration remains deployable on legacy data.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "quotationId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "bookings"
  WHERE "quotationId" IS NOT NULL
)
UPDATE "bookings" AS b
SET "quotationId" = NULL
FROM ranked AS r
WHERE b."id" = r."id"
  AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_quotationId_key"
  ON "bookings"("quotationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_quotationId_fkey'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "quotations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
