-- Migration: add_lead_and_lead_status
-- Adds LeadCategory enum, LeadStatus, and Lead models for CRM pipeline

-- Create LeadCategory enum
DO $$ BEGIN
  CREATE TYPE "LeadCategory" AS ENUM ('WEDDINGS', 'MICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create lead_statuses table
CREATE TABLE IF NOT EXISTS "lead_statuses" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"       TEXT NOT NULL,
  "color"      TEXT NOT NULL DEFAULT '#6b7280',
  "category"   "LeadCategory" NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "isPipeline" BOOLEAN NOT NULL DEFAULT true,
  "isDefault"  BOOLEAN NOT NULL DEFAULT false,
  "isSystem"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lead_statuses_category_sortOrder_idx" ON "lead_statuses"("category", "sortOrder");

-- Create leads table
CREATE TABLE IF NOT EXISTS "leads" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"                  TEXT NOT NULL,
  "contactNumbers"        JSONB NOT NULL DEFAULT '[]',
  "email"                 TEXT,
  "category"              "LeadCategory" NOT NULL,
  "eventDate"             TIMESTAMP(3),
  "estimatedPax"          INTEGER,
  "budgetRange"           TEXT,
  "notes"                 TEXT,
  "venueId"               TEXT,
  "packageId"             TEXT,
  "eventTypeId"           TEXT,
  "sourceOfInformationId" TEXT,
  "statusId"              TEXT NOT NULL,
  "createdById"           TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leads_statusId_idx"    ON "leads"("statusId");
CREATE INDEX IF NOT EXISTS "leads_createdById_idx" ON "leads"("createdById");
CREATE INDEX IF NOT EXISTS "leads_category_idx"    ON "leads"("category");
CREATE INDEX IF NOT EXISTS "leads_eventDate_idx"   ON "leads"("eventDate");
CREATE INDEX IF NOT EXISTS "leads_venueId_idx"     ON "leads"("venueId");

-- Add foreign keys (drop first to be idempotent)
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_venueId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_packageId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_eventTypeId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_sourceOfInformationId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_statusId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_createdById_fkey";

ALTER TABLE "leads" ADD CONSTRAINT "leads_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_eventTypeId_fkey"
  FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_sourceOfInformationId_fkey"
  FOREIGN KEY ("sourceOfInformationId") REFERENCES "source_of_informations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "lead_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default LeadStatus for WEDDINGS
INSERT INTO "lead_statuses" ("id", "name", "color", "category", "sortOrder", "isPipeline", "isDefault", "isSystem")
VALUES
  ('ls-w-1', 'New Lead',      '#6b7280', 'WEDDINGS', 1, true,  true,  false),
  ('ls-w-2', 'Contacted',     '#6b7280', 'WEDDINGS', 2, true,  false, false),
  ('ls-w-3', 'Qualified',     '#6b7280', 'WEDDINGS', 3, true,  false, false),
  ('ls-w-4', 'Proposal Sent', '#6b7280', 'WEDDINGS', 4, true,  false, false),
  ('ls-w-5', 'Negotiating',   '#6b7280', 'WEDDINGS', 5, true,  false, false),
  ('ls-w-6', 'Won',           '#6b7280', 'WEDDINGS', 6, false, false, true),
  ('ls-w-7', 'Lost',          '#6b7280', 'WEDDINGS', 7, false, false, true)
ON CONFLICT DO NOTHING;

-- Seed default LeadStatus for MICE
INSERT INTO "lead_statuses" ("id", "name", "color", "category", "sortOrder", "isPipeline", "isDefault", "isSystem")
VALUES
  ('ls-m-1', 'New Lead',      '#6b7280', 'MICE', 1, true,  true,  false),
  ('ls-m-2', 'Contacted',     '#6b7280', 'MICE', 2, true,  false, false),
  ('ls-m-3', 'Qualified',     '#6b7280', 'MICE', 3, true,  false, false),
  ('ls-m-4', 'Proposal Sent', '#6b7280', 'MICE', 4, true,  false, false),
  ('ls-m-5', 'Negotiating',   '#6b7280', 'MICE', 5, true,  false, false),
  ('ls-m-6', 'Won',           '#6b7280', 'MICE', 6, false, false, true),
  ('ls-m-7', 'Lost',          '#6b7280', 'MICE', 7, false, false, true)
ON CONFLICT DO NOTHING;
