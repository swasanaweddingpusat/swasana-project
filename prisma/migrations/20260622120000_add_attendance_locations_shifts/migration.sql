-- CreateTable: work_locations
CREATE TABLE IF NOT EXISTS "work_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "venueId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_locations_venueId_idx" ON "work_locations"("venueId");

-- CreateTable: work_shifts
CREATE TABLE IF NOT EXISTS "work_shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_work_assignments
CREATE TABLE IF NOT EXISTS "employee_work_assignments" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "workLocationId" TEXT NOT NULL,
    "workShiftId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_work_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_work_assignments_profileId_workLocationId_workShiftId_key" ON "employee_work_assignments"("profileId", "workLocationId", "workShiftId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_profileId_idx" ON "employee_work_assignments"("profileId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_workLocationId_idx" ON "employee_work_assignments"("workLocationId");
CREATE INDEX IF NOT EXISTS "employee_work_assignments_workShiftId_idx" ON "employee_work_assignments"("workShiftId");

-- CreateTable: shift_overrides
CREATE TABLE IF NOT EXISTS "shift_overrides" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workShiftId" TEXT NOT NULL,
    "workLocationId" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shift_overrides_profileId_date_key" ON "shift_overrides"("profileId", "date");
CREATE INDEX IF NOT EXISTS "shift_overrides_profileId_idx" ON "shift_overrides"("profileId");
CREATE INDEX IF NOT EXISTS "shift_overrides_date_idx" ON "shift_overrides"("date");

-- AlterTable: attendances
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workLocationId" TEXT;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workShiftId" TEXT;
CREATE INDEX IF NOT EXISTS "attendances_workLocationId_idx" ON "attendances"("workLocationId");
CREATE INDEX IF NOT EXISTS "attendances_workShiftId_idx" ON "attendances"("workShiftId");

-- AlterTable: attendance_settings
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "defaultLateToleranceMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "requireClockOutLocation" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKeys
DO $$ BEGIN
  ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_work_assignments" ADD CONSTRAINT "employee_work_assignments_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_overrides" ADD CONSTRAINT "shift_overrides_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate existing data
DO $$
DECLARE
  v_settings_id TEXT;
  v_start_time TEXT;
  v_end_time TEXT;
  v_tolerance INT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_radius INT;
  v_loc_id TEXT;
  v_shift_id TEXT;
BEGIN
  SELECT id, "workStartTime", "workEndTime", "lateToleranceMinutes", "officeLatitude", "officeLongitude", "officeRadiusMeters"
  INTO v_settings_id, v_start_time, v_end_time, v_tolerance, v_lat, v_lng, v_radius
  FROM attendance_settings
  LIMIT 1;

  IF v_settings_id IS NOT NULL THEN
    v_loc_id := gen_random_uuid()::text;
    v_shift_id := gen_random_uuid()::text;

    INSERT INTO work_locations (id, name, latitude, longitude, "radiusMeters", "isActive", "sortOrder", "createdAt", "updatedAt")
    VALUES (v_loc_id, 'Kantor Utama', v_lat, v_lng, v_radius, true, 0, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    INSERT INTO work_shifts (id, name, "startTime", "endTime", "lateToleranceMinutes", "isOvernight", "isActive", "sortOrder", "createdAt", "updatedAt")
    VALUES (v_shift_id, 'Reguler', v_start_time, v_end_time, v_tolerance, false, true, 0, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    UPDATE attendance_settings SET "defaultLateToleranceMinutes" = v_tolerance WHERE id = v_settings_id;
  END IF;
END $$;

-- Seed permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-attendance', 'view', 'View attendance settings, locations, shifts', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'create', 'Create locations, shifts, assignments', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'edit', 'Edit locations, shifts, assignments, overrides', 20),
  (gen_random_uuid()::text, 'hr-attendance', 'delete', 'Delete locations, shifts', 20)
ON CONFLICT (module, action) DO NOTHING;
