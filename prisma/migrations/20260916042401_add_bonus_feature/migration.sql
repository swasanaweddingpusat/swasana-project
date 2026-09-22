-- AlterTable
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "draftBonuses" JSONB;

-- CreateTable: bonuses (master)
CREATE TABLE IF NOT EXISTS "bonuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: snap_booking_bonuses (snapshot per booking)
CREATE TABLE IF NOT EXISTS "snap_booking_bonuses" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bonusId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_booking_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "snap_booking_bonuses_bookingId_idx" ON "snap_booking_bonuses"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "snap_booking_bonuses_bonusId_idx" ON "snap_booking_bonuses"("bonusId");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "snap_booking_bonuses"
    ADD CONSTRAINT "snap_booking_bonuses_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: nullable FK to bonuses (SetNull on delete)
DO $$
BEGIN
  ALTER TABLE "snap_booking_bonuses"
    ADD CONSTRAINT "snap_booking_bonuses_bonusId_fkey"
    FOREIGN KEY ("bonusId") REFERENCES "bonuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Permission rows for the `bonus` module (idempotent). Mirrors how `complimentary`
-- was seeded in 20260814120000_sync_roles_permissions_modules/migration.sql.
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt") VALUES
  (gen_random_uuid(), 'bonus', 'view', 0, NOW()),
  (gen_random_uuid(), 'bonus', 'create', 0, NOW()),
  (gen_random_uuid(), 'bonus', 'edit', 0, NOW()),
  (gen_random_uuid(), 'bonus', 'delete', 0, NOW())
ON CONFLICT ("module", "action") DO NOTHING;

-- Map the `bonus` permission-module to the booking world module (mirrors
-- ('mpm_bk_comp', 'mod_booking', 'complimentary') seeded in the same precedent migration).
-- module_permission_maps has a UNIQUE("moduleId","permissionModule") index, so ON CONFLICT applies.
INSERT INTO "module_permission_maps" ("id", "moduleId", "permissionModule") VALUES
  (gen_random_uuid(), 'mod_booking', 'bonus')
ON CONFLICT ("moduleId", "permissionModule") DO NOTHING;
