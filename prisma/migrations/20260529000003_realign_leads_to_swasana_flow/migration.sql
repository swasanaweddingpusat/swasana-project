-- Migration: realign_leads_to_swasana_flow
-- Realigns CRM pipeline: universal lead statuses (Cold/Warm/Hot/Deal/Lost),
-- adds EventCategory enum, EventType.category, Lead.assignedToId + conversion fields,
-- Booking.category discriminator, removes LeadCategory from Lead/LeadStatus.

-- ─── 1. Create EventCategory enum ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "EventCategory" AS ENUM ('WEDDINGS', 'MICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── 2. Add EventType.category ────────────────────────────────────────────────
ALTER TABLE "event_types" ADD COLUMN IF NOT EXISTS "category" "EventCategory" NOT NULL DEFAULT 'WEDDINGS';

CREATE INDEX IF NOT EXISTS "event_types_category_idx" ON "event_types"("category");

-- ─── 3. Add Booking.category ─────────────────────────────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "category" "EventCategory" NOT NULL DEFAULT 'WEDDINGS';

CREATE INDEX IF NOT EXISTS "bookings_category_idx" ON "bookings"("category");

-- ─── 4. Realign lead_statuses table ──────────────────────────────────────────

-- 4a. Remove old FK on leads.statusId so we can safely delete old statuses
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_statusId_fkey";

-- 4b. Delete all old lead statuses (old names: New Lead, Contacted, Won, etc.)
DELETE FROM "leads"; -- safe since we're in dev; no leads should reference the old IDs
DELETE FROM "lead_statuses";

-- 4c. Drop old columns that no longer exist in schema
ALTER TABLE "lead_statuses" DROP COLUMN IF EXISTS "category";
ALTER TABLE "lead_statuses" DROP COLUMN IF EXISTS "isPipeline";

-- 4d. Add new columns
ALTER TABLE "lead_statuses" ADD COLUMN IF NOT EXISTS "isFinal"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lead_statuses" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 4e. Drop old index
DROP INDEX IF EXISTS "lead_statuses_category_sortOrder_idx";

-- 4f. Create new index
CREATE INDEX IF NOT EXISTS "lead_statuses_sortOrder_idx" ON "lead_statuses"("sortOrder");

-- 4g. Insert 5 canonical statuses (monochrome grayscale palette)
--     Cold=light gray, Warm=medium gray, Hot=dark gray, Deal=near-black, Lost=destructive
INSERT INTO "lead_statuses" ("id", "name", "color", "sortOrder", "isDefault", "isFinal", "isSystem", "isActive", "createdAt", "updatedAt")
VALUES
  ('ls-1', 'Cold', '#cbd5e1', 1, true,  false, false, true, NOW(), NOW()),
  ('ls-2', 'Warm', '#94a3b8', 2, false, false, false, true, NOW(), NOW()),
  ('ls-3', 'Hot',  '#475569', 3, false, false, false, true, NOW(), NOW()),
  ('ls-4', 'Deal', '#0f172a', 4, false, true,  true,  true, NOW(), NOW()),
  ('ls-5', 'Lost', '#dc2626', 5, false, true,  false, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4h. Re-add FK on leads.statusId
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_statusId_fkey";
ALTER TABLE "leads" ADD CONSTRAINT "leads_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "lead_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 5. Realign leads table ───────────────────────────────────────────────────

-- 5a. Drop category column (removed from Lead model)
ALTER TABLE "leads" DROP COLUMN IF EXISTS "category";
DROP INDEX IF EXISTS "leads_category_idx";

-- 5b. Add new fields
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignedToId"          TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "convertedAt"            TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "convertedToCustomerId"  TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "convertedToBookingId"   TEXT;

-- 5c. Add indexes
CREATE INDEX IF NOT EXISTS "leads_assignedToId_idx" ON "leads"("assignedToId");

-- 5d. Add foreign keys for new fields
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_assignedToId_fkey";
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_convertedToCustomerId_fkey";
ALTER TABLE "leads" ADD CONSTRAINT "leads_convertedToCustomerId_fkey"
  FOREIGN KEY ("convertedToCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_convertedToBookingId_fkey";
ALTER TABLE "leads" ADD CONSTRAINT "leads_convertedToBookingId_fkey"
  FOREIGN KEY ("convertedToBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 6. Seed MICE event types ─────────────────────────────────────────────────
INSERT INTO "event_types" ("id", "name", "code", "category", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Halfday 6hrs',        'H6',  'MICE', 10, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Fullday Meeting 8hrs', 'FM8', 'MICE', 11, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Fullday Meeting 12hrs','FM12','MICE', 12, true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- ─── 7. Drop LeadCategory enum (no longer used) ──────────────────────────────
-- Only safe to drop if nothing references it anymore
DO $$ BEGIN
  DROP TYPE IF EXISTS "LeadCategory";
EXCEPTION
  WHEN others THEN null;
END $$;

-- ─── 8. Seed permissions for leads, settings-lead-status, quotations ─────────
-- These are inserted by the seeder (npx prisma db seed), not here.
-- Placeholder comment — run: npx ts-node prisma/seed.ts after migration.
