-- Add packageTypeCategoryId to packages (nullable FK -> package_type_category)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "packageTypeCategoryId" TEXT;

DO $$ BEGIN
  ALTER TABLE "packages"
    ADD CONSTRAINT "packages_packageTypeCategoryId_fkey"
    FOREIGN KEY ("packageTypeCategoryId") REFERENCES "package_type_category"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "packages_packageTypeCategoryId_idx" ON "packages"("packageTypeCategoryId");

-- Denormalized (frozen) category name/code on the booking-finalize snapshot
ALTER TABLE "snap_packages" ADD COLUMN IF NOT EXISTS "packageTypeCategoryName" TEXT;
ALTER TABLE "snap_packages" ADD COLUMN IF NOT EXISTS "packageTypeCategoryCode" TEXT;

-- Backfill: packages whose name contains "HADJATAN" -> Hadjatan category,
-- everything else still unset -> Regular category (default).
UPDATE "packages"
SET "packageTypeCategoryId" = (SELECT "id" FROM "package_type_category" WHERE "code" = 'HADJATAN')
WHERE "packageName" ILIKE '%HADJATAN%' AND "packageTypeCategoryId" IS NULL;

UPDATE "packages"
SET "packageTypeCategoryId" = (SELECT "id" FROM "package_type_category" WHERE "code" = 'REGULAR')
WHERE "packageTypeCategoryId" IS NULL;
