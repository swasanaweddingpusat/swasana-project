-- Reconcile schema drift: `Vendor.bankName` exists in schema.prisma + dev DB,
-- but was missing from staging/prod (lost during the flatten baseline).
-- Idempotent so it is a no-op where the column already exists (e.g. dev).
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
