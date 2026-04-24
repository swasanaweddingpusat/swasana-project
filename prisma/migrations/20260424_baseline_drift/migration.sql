-- Baseline migration: sync drift between DB and migration history

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

CREATE TABLE IF NOT EXISTS "education_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "education_levels_name_key" ON "education_levels"("name");

CREATE TABLE IF NOT EXISTS "order_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "order_statuses_name_key" ON "order_statuses"("name");

ALTER TABLE "profiles"
    ADD COLUMN IF NOT EXISTS "bankAccountHolder" TEXT,
    ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "bankName" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
    ADD COLUMN IF NOT EXISTS "gender" "Gender",
    ADD COLUMN IF NOT EXISTS "kkNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "nik" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_employeeId_key" ON "profiles"("employeeId");

ALTER TABLE "snap_bonuses"
    ADD COLUMN IF NOT EXISTS "nominal" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "orderStatusId" TEXT;
CREATE INDEX IF NOT EXISTS "snap_bonuses_orderStatusId_idx" ON "snap_bonuses"("orderStatusId");
ALTER TABLE "snap_bonuses" DROP CONSTRAINT IF EXISTS "snap_bonuses_orderStatusId_fkey";
ALTER TABLE "snap_bonuses" ADD CONSTRAINT "snap_bonuses_orderStatusId_fkey"
    FOREIGN KEY ("orderStatusId") REFERENCES "order_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "snap_vendor_items"
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "orderStatusId" TEXT;
CREATE INDEX IF NOT EXISTS "snap_vendor_items_orderStatusId_idx" ON "snap_vendor_items"("orderStatusId");
ALTER TABLE "snap_vendor_items" DROP CONSTRAINT IF EXISTS "snap_vendor_items_orderStatusId_fkey";
ALTER TABLE "snap_vendor_items" ADD CONSTRAINT "snap_vendor_items_orderStatusId_fkey"
    FOREIGN KEY ("orderStatusId") REFERENCES "order_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
