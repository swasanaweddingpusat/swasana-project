-- CreateEnum
CREATE TYPE "WeddingIndicatorShareStatus" AS ENUM ('Active', 'Revoked');

-- CreateTable
CREATE TABLE IF NOT EXISTS "wedding_indicator_shares" (
    "id" TEXT NOT NULL,
    "weddingIndicatorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "status" "WeddingIndicatorShareStatus" NOT NULL DEFAULT 'Active',
    "viewedAt" TIMESTAMP(3),
    "lastEditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_indicator_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wedding_indicator_shares_weddingIndicatorId_key" ON "wedding_indicator_shares"("weddingIndicatorId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wedding_indicator_shares_token_key" ON "wedding_indicator_shares"("token");

-- AddForeignKey
ALTER TABLE "wedding_indicator_shares" ADD CONSTRAINT "wedding_indicator_shares_weddingIndicatorId_fkey" FOREIGN KEY ("weddingIndicatorId") REFERENCES "wedding_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
