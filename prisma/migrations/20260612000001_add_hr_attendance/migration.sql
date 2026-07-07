-- CreateEnum: AttendanceStatus
DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('on_time', 'late', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: attendances
CREATE TABLE IF NOT EXISTS "attendances" (
    "id"               TEXT NOT NULL,
    "profileId"        TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL,
    "clockInAt"        TIMESTAMP(3),
    "clockInPhotoUrl"  TEXT,
    "clockInLat"       DOUBLE PRECISION,
    "clockInLng"       DOUBLE PRECISION,
    "clockOutAt"       TIMESTAMP(3),
    "clockOutPhotoUrl" TEXT,
    "clockOutLat"      DOUBLE PRECISION,
    "clockOutLng"      DOUBLE PRECISION,
    "status"           "AttendanceStatus" NOT NULL DEFAULT 'absent',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable: attendance_settings
CREATE TABLE IF NOT EXISTS "attendance_settings" (
    "id"                   TEXT NOT NULL,
    "workStartTime"        TEXT NOT NULL,
    "workEndTime"          TEXT NOT NULL,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "officeLatitude"       DOUBLE PRECISION NOT NULL,
    "officeLongitude"      DOUBLE PRECISION NOT NULL,
    "officeRadiusMeters"   INTEGER NOT NULL DEFAULT 100,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_profileId_date_key";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_profileId_date_key"
  UNIQUE ("profileId", "date");

-- Indexes
CREATE INDEX IF NOT EXISTS "attendances_profileId_idx" ON "attendances"("profileId");
CREATE INDEX IF NOT EXISTS "attendances_date_idx" ON "attendances"("date");

-- Foreign key
DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed hr permissions
INSERT INTO "permissions" (id, module, action)
VALUES
  (gen_random_uuid()::text, 'hr', 'view'),
  (gen_random_uuid()::text, 'hr', 'view-all')
ON CONFLICT (module, action) DO NOTHING;
