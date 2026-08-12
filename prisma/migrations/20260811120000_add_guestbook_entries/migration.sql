-- CreateEnum
CREATE TYPE "GuestVisitPurpose" AS ENUM ('client_visit', 'vendor_meeting', 'interview', 'delivery', 'other');

-- CreateTable
CREATE TABLE IF NOT EXISTS "guestbook_entries" (
    "id" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "idNumber" TEXT,
    "purpose" "GuestVisitPurpose" NOT NULL DEFAULT 'other',
    "purposeNote" TEXT,
    "hostId" TEXT,
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guestbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "guestbook_entries_checkInAt_idx" ON "guestbook_entries"("checkInAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "guestbook_entries_hostId_idx" ON "guestbook_entries"("hostId");

-- AddForeignKey
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
