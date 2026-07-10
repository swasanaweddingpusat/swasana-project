-- AlterTable
ALTER TABLE "wedding_indicator_shares" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
