-- Retire packages.securityDeposit. Security Deposit is represented by rows in
-- package_mice_tax_deposits instead of a dedicated package column.
ALTER TABLE "packages" DROP COLUMN IF EXISTS "securityDeposit";
