-- AlterTable
ALTER TABLE "public_holidays" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wedding_indicators" ALTER COLUMN "questionnaireData" SET DEFAULT '{}'::jsonb;
