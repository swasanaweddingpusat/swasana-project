-- AlterTable: add managerId to user_venue_access
ALTER TABLE "user_venue_access" ADD COLUMN "managerId" TEXT;
CREATE INDEX "user_venue_access_managerId_idx" ON "user_venue_access"("managerId");
ALTER TABLE "user_venue_access" ADD CONSTRAINT "user_venue_access_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add termAndCondition to venues
ALTER TABLE "venues" ADD COLUMN "termAndCondition" TEXT;

-- CreateTable: event_types
CREATE TABLE "event_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_types_code_key" ON "event_types"("code");

-- CreateTable: counters
CREATE TABLE "counters" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);
