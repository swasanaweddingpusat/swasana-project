-- AlterTable
ALTER TABLE "package_variants" DROP COLUMN "price",
ADD COLUMN     "margin" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "package_variant_category_prices" (
    "id" TEXT NOT NULL,
    "packageVariantId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_variant_category_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_variant_category_prices_packageVariantId_idx" ON "package_variant_category_prices"("packageVariantId");

-- AddForeignKey
ALTER TABLE "package_variant_category_prices" ADD CONSTRAINT "package_variant_category_prices_packageVariantId_fkey" FOREIGN KEY ("packageVariantId") REFERENCES "package_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
