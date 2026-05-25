-- Add soft-delete column to package_variants
ALTER TABLE "package_variants" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Composite index for efficient soft-delete filtering per package
CREATE INDEX IF NOT EXISTS "package_variants_packageId_deletedAt_idx"
  ON "package_variants" ("packageId", "deletedAt");
