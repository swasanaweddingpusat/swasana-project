-- Add termAndCondition to snap_package_pricing (snapshot T&C per booking)
ALTER TABLE "snap_package_pricing" ADD COLUMN IF NOT EXISTS "termAndCondition" TEXT;
