-- AddColumn cppIdType and cpwIdType to customers table
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cppIdType" TEXT NOT NULL DEFAULT 'KTP';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cpwIdType" TEXT NOT NULL DEFAULT 'KTP';

-- AddColumn cppIdType and cpwIdType to snap_customers table
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "cppIdType" TEXT NOT NULL DEFAULT 'KTP';
ALTER TABLE "snap_customers" ADD COLUMN IF NOT EXISTS "cpwIdType" TEXT NOT NULL DEFAULT 'KTP';
