-- CreateEnum GeofenceStatus
DO $$ BEGIN
  CREATE TYPE "GeofenceStatus" AS ENUM ('IN_RANGE', 'OUT_OF_RANGE', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable attendances
CREATE TABLE IF NOT EXISTS "attendances" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "photoCheckInUrl" TEXT,
    "photoCheckOutUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "geofenceStatus" "GeofenceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_profileId_idx" ON "attendances"("profileId");
CREATE INDEX IF NOT EXISTS "attendances_clockIn_idx" ON "attendances"("clockIn");
