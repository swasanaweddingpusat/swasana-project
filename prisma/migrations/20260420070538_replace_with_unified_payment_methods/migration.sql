/*
  Warnings:

  - You are about to drop the `vendor_payment_methods` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "vendor_payment_methods" DROP CONSTRAINT "vendor_payment_methods_vendorId_fkey";

-- DropTable
DROP TABLE "vendor_payment_methods";

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "venueId" TEXT,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankRecipient" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_methods_vendorId_idx" ON "payment_methods"("vendorId");

-- CreateIndex
CREATE INDEX "payment_methods_venueId_idx" ON "payment_methods"("venueId");

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
