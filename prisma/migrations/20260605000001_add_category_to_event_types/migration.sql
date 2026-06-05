-- Add category column to event_types table
-- EventCategory enum already exists from migration 20260529000003_realign_leads_to_swasana_flow

ALTER TABLE "event_types"
  ADD COLUMN IF NOT EXISTS "category" "EventCategory" NOT NULL DEFAULT 'WEDDINGS';

-- Index already defined in schema
CREATE INDEX IF NOT EXISTS "event_types_category_idx" ON "event_types"("category");
