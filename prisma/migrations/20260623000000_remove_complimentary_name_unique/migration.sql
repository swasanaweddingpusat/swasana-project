-- AlterTable: remove unique constraint on complimentaries.name
ALTER TABLE "complimentaries" DROP CONSTRAINT IF EXISTS "complimentaries_name_key";
