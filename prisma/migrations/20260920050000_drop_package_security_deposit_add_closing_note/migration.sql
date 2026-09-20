-- Retire packages.securityDeposit. Product decision: Security Deposit is now
-- just a regular line item the user adds manually inside the Step 2
-- "Tax & Deposit" tab (package_mice_tax_deposits, name+nominal), not a
-- dedicated Package column. cancellationRefundPolicy and
-- package_mice_tax_deposits (added in the same prior migration) are unaffected.

ALTER TABLE "packages" DROP COLUMN IF EXISTS "securityDeposit";

-- Add packages.closingNote — Step 4 "Closing" editor, same nullable rich-text
-- shape/gating (term-&-condition permission) as termAndCondition and
-- cancellationRefundPolicy. Mirrors quotations.closingNote naming.
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "closingNote" TEXT;
