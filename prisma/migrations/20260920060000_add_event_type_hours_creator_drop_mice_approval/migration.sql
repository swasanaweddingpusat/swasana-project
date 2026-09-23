-- Add MICE event detail (eventTypeId, eventHours) + audit (createdById, updatedById)
-- to packages, and remove the MICE approval flow (packages.category = 'MICE').
--
-- approvalStatus stays on the shared "packages" table because Package Wedding still
-- relies on it. MICE packages simply skip approval: existing MICE approval records
-- are deleted below and every MICE package is flipped to 'approved' so it remains
-- consumable by quotations.

-- 1. Event type (nullable FK -> event_types)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "eventTypeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "packages"
    ADD CONSTRAINT "packages_eventTypeId_fkey"
    FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "packages_eventTypeId_idx" ON "packages"("eventTypeId");

-- 2. Event hours (free-text time range, e.g. "09:00 - 13:00")
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "eventHours" TEXT;

-- 3. Audit columns (nullable FK -> profiles; existing rows stay NULL)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "packages"
    ADD CONSTRAINT "packages_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "packages"
    ADD CONSTRAINT "packages_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "packages_createdById_idx" ON "packages"("createdById");
CREATE INDEX IF NOT EXISTS "packages_updatedById_idx" ON "packages"("updatedById");

-- 4. Drop the MICE approval flow. Steps first (FK cascade is NOT relied on here to
--    keep the statement order explicit), then the records, then mark all MICE
--    packages approved so they are immediately available/consumable.
DELETE FROM "approval_record_steps"
WHERE "recordId" IN (
  SELECT "id" FROM "approval_records" WHERE "module" = 'package-mice'
);

DELETE FROM "approval_records"
WHERE "module" = 'package-mice';

UPDATE "packages"
SET "approvalStatus" = 'approved'
WHERE "category" = 'MICE';
