-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('Pending', 'Uploaded', 'Confirmed', 'Rejected', 'Canceled', 'Lost');

-- CreateEnum
CREATE TYPE "WeddingSession" AS ENUM ('morning', 'afternoon', 'evening', 'fullday');

-- CreateEnum
CREATE TYPE "WeddingType" AS ENUM ('wedding', 'engagement', 'akad', 'resepsi', 'other');

-- CreateEnum
CREATE TYPE "TermOfPaymentStatus" AS ENUM ('unpaid', 'paid', 'partial');

-- CreateEnum
CREATE TYPE "BookingRefundStatus" AS ENUM ('pending', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'Pending',
    "paymentStatus" TEXT NOT NULL DEFAULT '',
    "weddingSession" "WeddingSession",
    "weddingType" "WeddingType",
    "poNumber" TEXT,
    "rejectionNotes" TEXT,
    "signingLocation" TEXT,
    "signatures" JSONB,
    "vendorComments" JSONB DEFAULT '{}',
    "salesId" TEXT NOT NULL,
    "managerId" TEXT,
    "customerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageVariantId" TEXT,
    "paymentMethodId" TEXT,
    "sourceOfInformationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_customers" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "nikNumber" TEXT,
    "ktpAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snap_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_venues" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "extraHoursPrice" BIGINT,
    "brandName" TEXT,
    "brandCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snap_venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_packages" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snap_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_package_variants" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "pax" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snap_package_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_package_internal_items" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_package_internal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_package_vendor_items" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "itemText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_package_vendor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_bonuses" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorCategoryId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_vendor_items" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorCategoryId" TEXT NOT NULL,
    "vendorCategoryName" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemPrice" BIGINT NOT NULL DEFAULT 0,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "totalPrice" BIGINT NOT NULL DEFAULT 0,
    "isAddons" BOOLEAN NOT NULL DEFAULT false,
    "paketData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_vendor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_of_payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "TermOfPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "paymentEvidence" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_of_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_documents" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "fileType" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_refunds" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorCategoryId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "paymentMethodId" TEXT NOT NULL,
    "status" "BookingRefundStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "refundDate" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_salesId_idx" ON "bookings"("salesId");

-- CreateIndex
CREATE INDEX "bookings_managerId_idx" ON "bookings"("managerId");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE INDEX "bookings_venueId_idx" ON "bookings"("venueId");

-- CreateIndex
CREATE INDEX "bookings_packageId_idx" ON "bookings"("packageId");

-- CreateIndex
CREATE INDEX "bookings_bookingStatus_idx" ON "bookings"("bookingStatus");

-- CreateIndex
CREATE INDEX "bookings_bookingDate_idx" ON "bookings"("bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "snap_customers_bookingId_key" ON "snap_customers"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "snap_venues_bookingId_key" ON "snap_venues"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "snap_packages_bookingId_key" ON "snap_packages"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "snap_package_variants_bookingId_key" ON "snap_package_variants"("bookingId");

-- CreateIndex
CREATE INDEX "snap_package_internal_items_bookingId_idx" ON "snap_package_internal_items"("bookingId");

-- CreateIndex
CREATE INDEX "snap_package_vendor_items_bookingId_idx" ON "snap_package_vendor_items"("bookingId");

-- CreateIndex
CREATE INDEX "snap_bonuses_bookingId_idx" ON "snap_bonuses"("bookingId");

-- CreateIndex
CREATE INDEX "snap_vendor_items_bookingId_idx" ON "snap_vendor_items"("bookingId");

-- CreateIndex
CREATE INDEX "term_of_payments_bookingId_idx" ON "term_of_payments"("bookingId");

-- CreateIndex
CREATE INDEX "booking_documents_bookingId_idx" ON "booking_documents"("bookingId");

-- CreateIndex
CREATE INDEX "booking_refunds_bookingId_idx" ON "booking_refunds"("bookingId");

-- CreateIndex
CREATE INDEX "booking_refunds_status_idx" ON "booking_refunds"("status");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sourceOfInformationId_fkey" FOREIGN KEY ("sourceOfInformationId") REFERENCES "source_of_informations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_customers" ADD CONSTRAINT "snap_customers_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_venues" ADD CONSTRAINT "snap_venues_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_packages" ADD CONSTRAINT "snap_packages_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_package_variants" ADD CONSTRAINT "snap_package_variants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_package_internal_items" ADD CONSTRAINT "snap_package_internal_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_package_vendor_items" ADD CONSTRAINT "snap_package_vendor_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_bonuses" ADD CONSTRAINT "snap_bonuses_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_vendor_items" ADD CONSTRAINT "snap_vendor_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_of_payments" ADD CONSTRAINT "term_of_payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
