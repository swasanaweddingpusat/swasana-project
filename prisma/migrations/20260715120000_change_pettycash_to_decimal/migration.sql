-- Change pettyCash from boolean to numeric (decimal)
-- Convert existing boolean values to 0/1 numeric and set default 0

BEGIN;
-- Drop existing default (boolean) so the type can be changed cleanly
ALTER TABLE "procurement_items" ALTER COLUMN "pettyCash" DROP DEFAULT;
-- Convert boolean values to numeric (1 for true, 0 for false)
ALTER TABLE "procurement_items" ALTER COLUMN "pettyCash" TYPE numeric USING (CASE WHEN "pettyCash" = true THEN 1 ELSE 0 END);
-- Set a numeric default
ALTER TABLE "procurement_items" ALTER COLUMN "pettyCash" SET DEFAULT 0;
COMMIT;
