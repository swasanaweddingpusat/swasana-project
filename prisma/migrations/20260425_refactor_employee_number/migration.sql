-- Drop old employeeId column and unique index
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "employeeId";

-- Create sequence for employeeNumber
CREATE SEQUENCE IF NOT EXISTS "profiles_employeeNumber_seq";

-- Add employeeNumber column with autoincrement
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "employeeNumber" INTEGER NOT NULL DEFAULT nextval('"profiles_employeeNumber_seq"');

-- Attach sequence ownership to column
ALTER SEQUENCE "profiles_employeeNumber_seq" OWNED BY "profiles"."employeeNumber";

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_employeeNumber_key" ON "profiles"("employeeNumber");
