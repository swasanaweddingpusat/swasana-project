/*
  Warnings:

  - You are about to alter the column `amount` on the `booking_payment_settlements` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to drop the column `selling_price` on the `packages` table. All the data in the column will be lost.
  - You are about to drop the column `term_and_condition` on the `packages` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `profiles` table. All the data in the column will be lost.
  - You are about to alter the column `nominal` on the `snap_bonuses` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `price` on the `snap_package_pricing` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `itemPrice` on the `snap_vendor_items` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `totalPrice` on the `snap_vendor_items` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `amount` on the `term_of_payments` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - Made the column `packageId` on table `package_category_prices` required. This step will fail if there are existing NULL values in that column.
  - Made the column `packageId` on table `package_internal_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `packageId` on table `package_vendor_items` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX IF EXISTS "approval_records_module_entityId_idx";

-- DropIndex
DROP INDEX IF EXISTS "customers_mobileNumber_idx";

-- AlterTable
ALTER TABLE "booking_payment_settlements" ALTER COLUMN "amount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "lead_statuses" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable — rename constraint first (separate statement required by PostgreSQL)
-- Only rename if the old name still exists (idempotent: prev migration may have already created it with new name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'package_variant_category_prices_pkey'
      AND conrelid = 'package_category_prices'::regclass
  ) THEN
    ALTER TABLE "package_category_prices" RENAME CONSTRAINT "package_variant_category_prices_pkey" TO "package_category_prices_pkey";
  END IF;
END $$;

-- AlterTable — then alter columns
ALTER TABLE "package_category_prices"
ALTER COLUMN "isShow" SET DEFAULT false,
ALTER COLUMN "packageId" SET NOT NULL;

-- AlterTable
ALTER TABLE "package_internal_items" ALTER COLUMN "packageId" SET NOT NULL;

-- AlterTable
ALTER TABLE "package_vendor_items" ALTER COLUMN "packageId" SET NOT NULL;

-- AlterTable
ALTER TABLE "packages" DROP COLUMN "selling_price",
DROP COLUMN "term_and_condition",
ADD COLUMN     "sellingPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "termAndCondition" TEXT;

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "timezone";

-- AlterTable
ALTER TABLE "snap_bonuses" ALTER COLUMN "nominal" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "snap_package_category_prices" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "snap_package_pricing" ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "snap_vendor_items" ALTER COLUMN "itemPrice" SET DATA TYPE INTEGER,
ALTER COLUMN "totalPrice" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "term_of_payments" ALTER COLUMN "amount" SET DATA TYPE INTEGER;
