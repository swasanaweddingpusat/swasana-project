-- CreateEnum
CREATE TYPE "EventSession" AS ENUM ('pagi', 'malam', 'fullday');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('Pending', 'Sent', 'Viewed', 'Signed');

-- CreateTable
CREATE TABLE "client_agreements" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'Pending',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_agreements_bookingId_key" ON "client_agreements"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "client_agreements_token_key" ON "client_agreements"("token");

-- CreateIndex
CREATE INDEX "client_agreements_token_idx" ON "client_agreements"("token");

-- AddForeignKey
ALTER TABLE "client_agreements" ADD CONSTRAINT "client_agreements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
