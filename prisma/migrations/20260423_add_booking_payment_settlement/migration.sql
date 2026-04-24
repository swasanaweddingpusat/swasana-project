-- Drop old booking_refunds table
DROP TABLE IF EXISTS "booking_refunds";

-- Drop old enum
DROP TYPE IF EXISTS "BookingRefundStatus";

-- Create new enums
CREATE TYPE "SettlementType" AS ENUM ('refund', 'allocation');
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'completed', 'cancelled');

-- Create booking_payment_settlements table
CREATE TABLE "booking_payment_settlements" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "snapVendorItemId" TEXT NOT NULL,
    "type" "SettlementType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "paymentMethodId" TEXT,
    "targetBookingId" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_payment_settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_payment_settlements_bookingId_idx" ON "booking_payment_settlements"("bookingId");
CREATE INDEX "booking_payment_settlements_snapVendorItemId_idx" ON "booking_payment_settlements"("snapVendorItemId");
CREATE INDEX "booking_payment_settlements_status_idx" ON "booking_payment_settlements"("status");

ALTER TABLE "booking_payment_settlements" ADD CONSTRAINT "booking_payment_settlements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_payment_settlements" ADD CONSTRAINT "booking_payment_settlements_snapVendorItemId_fkey" FOREIGN KEY ("snapVendorItemId") REFERENCES "snap_vendor_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_payment_settlements" ADD CONSTRAINT "booking_payment_settlements_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_payment_settlements" ADD CONSTRAINT "booking_payment_settlements_targetBookingId_fkey" FOREIGN KEY ("targetBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_payment_settlements" ADD CONSTRAINT "booking_payment_settlements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
