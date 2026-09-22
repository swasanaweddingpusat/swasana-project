-- Create "package_type_category" — standalone master data grouping Packages
-- themselves (e.g. "Paket Hadjatan", "Paket Regular"). Separate from the
-- existing "categories" table, which is vendor-item master data used INSIDE
-- a package (Catering/Dekorasi/etc) and must not be reused for this concept.

CREATE TABLE IF NOT EXISTS "package_type_category" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "code"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "package_type_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "package_type_category_name_key" ON "package_type_category"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "package_type_category_code_key" ON "package_type_category"("code");

-- Reference data seed (idempotent) — matches the two default rows in the spec.
INSERT INTO "package_type_category" ("id", "name", "code", "sortOrder", "isActive", "updatedAt") VALUES
  (gen_random_uuid(), 'Paket Hadjatan', 'HADJATAN', 1, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Paket Regular', 'REGULAR', 2, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Permission rows for the `settings-package-category` module (idempotent).
-- Module name kept as-is: it's the settings PAGE identity, independent of
-- which table backs it.
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt") VALUES
  (gen_random_uuid(), 'settings-package-category', 'view', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings-package-category', 'create', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings-package-category', 'edit', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings-package-category', 'delete', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("module", "action") DO NOTHING;
