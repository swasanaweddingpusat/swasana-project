-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "venueId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_variants" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "pax" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_vendor_items" (
    "id" TEXT NOT NULL,
    "packageVariantId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "itemText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_vendor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_internal_items" (
    "id" TEXT NOT NULL,
    "packageVariantId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_internal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_venueId_idx" ON "packages"("venueId");

-- CreateIndex
CREATE INDEX "package_variants_packageId_idx" ON "package_variants"("packageId");

-- CreateIndex
CREATE INDEX "package_vendor_items_packageVariantId_idx" ON "package_vendor_items"("packageVariantId");

-- CreateIndex
CREATE INDEX "package_internal_items_packageVariantId_idx" ON "package_internal_items"("packageVariantId");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_variants" ADD CONSTRAINT "package_variants_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_vendor_items" ADD CONSTRAINT "package_vendor_items_packageVariantId_fkey" FOREIGN KEY ("packageVariantId") REFERENCES "package_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_internal_items" ADD CONSTRAINT "package_internal_items_packageVariantId_fkey" FOREIGN KEY ("packageVariantId") REFERENCES "package_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
