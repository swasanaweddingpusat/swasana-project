-- ─── Public Holiday + Attendant Type ─────────────────────────────────────────
-- Adds:
--   - public_holidays master table (tanggal merah)
--   - AttendantType enum (WORKDAY / DAY_OFF)
--   - attendances.attendantType, attendances.isPublicHoliday (frozen at clock-in)
--   - settings-public-holiday permission (view/create/edit/delete)

-- CreateEnum: AttendantType (idempotent)
DO $$ BEGIN
  CREATE TYPE "AttendantType" AS ENUM ('WORKDAY', 'DAY_OFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: public_holidays
CREATE TABLE IF NOT EXISTS "public_holidays" (
  "id"        TEXT                     NOT NULL DEFAULT gen_random_uuid(),
  "date"      TIMESTAMP(3)             NOT NULL,
  "name"      TEXT                     NOT NULL,
  "isActive"  BOOLEAN                  NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)             NOT NULL,

  CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_holidays_date_key" ON "public_holidays"("date");
CREATE INDEX IF NOT EXISTS "public_holidays_date_idx" ON "public_holidays"("date");

-- AlterTable attendances: add attendantType + isPublicHoliday
ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "attendantType" "AttendantType" NOT NULL DEFAULT 'WORKDAY',
  ADD COLUMN IF NOT EXISTS "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false;

-- ─── Seed: settings-public-holiday permission ────────────────────────────────
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'settings-public-holiday', 'view',   'View public holiday list', 0),
  (gen_random_uuid()::text, 'settings-public-holiday', 'create', 'Create public holiday', 0),
  (gen_random_uuid()::text, 'settings-public-holiday', 'edit',   'Edit public holiday', 0),
  (gen_random_uuid()::text, 'settings-public-holiday', 'delete', 'Delete public holiday', 0)
ON CONFLICT (module, action) DO NOTHING;

-- Grant settings-public-holiday:* to human-resource role
DO $$
DECLARE
  hr_role_id text;
BEGIN
  SELECT id INTO hr_role_id FROM "roles" WHERE name = 'human-resource';
  IF hr_role_id IS NULL THEN
    RAISE NOTICE 'human-resource role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), hr_role_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'settings-public-holiday' AND p.action IN ('view', 'create', 'edit', 'delete')
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;
