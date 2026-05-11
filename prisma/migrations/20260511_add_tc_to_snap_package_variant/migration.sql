-- Add termAndCondition to snap_package_variants (snapshot T&C per booking)
ALTER TABLE "snap_package_variants" ADD COLUMN IF NOT EXISTS "termAndCondition" TEXT;
