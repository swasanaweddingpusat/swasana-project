-- Migration: create_package_mice_items
-- Idempotent: uses IF NOT EXISTS / DO NOTHING guards

-- ─── Enum ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MiceItemPriceType') THEN
    CREATE TYPE "MiceItemPriceType" AS ENUM ('PAX', 'NOMINAL');
  END IF;
END
$$;

-- ─── package_mice_items ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "package_mice_items" (
  "id"              TEXT          NOT NULL,
  "packageId"       TEXT          NOT NULL,
  "itemName"        TEXT          NOT NULL,
  "itemDescription" TEXT          NOT NULL DEFAULT '',
  "itemType"        "MiceItemPriceType" NOT NULL DEFAULT 'PAX',
  "itemPrice"       INTEGER       NOT NULL DEFAULT 0,
  "sortOrder"       INTEGER       NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "package_mice_items_pkey" PRIMARY KEY ("id")
);

-- FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'package_mice_items_packageId_fkey'
  ) THEN
    ALTER TABLE "package_mice_items"
      ADD CONSTRAINT "package_mice_items_packageId_fkey"
      FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS "package_mice_items_packageId_idx" ON "package_mice_items"("packageId");
