-- Composite indexes for heavy read paths identified in performance audit
-- (Batch 2 / P3): Ledger (Finance AR listing), DailyActivity (daily-activity /
-- leads listing), Quotation (quotations listing). Idempotent — safe to run
-- multiple times.

-- Ledger: Finance AR listing filters direction + ackStatus, excludes voided
-- rows, sorts by occurredAt.
CREATE INDEX IF NOT EXISTS "ledgers_direction_ack_status_voided_at_occurred_at_idx"
  ON "ledgers" ("direction", "ackStatus", "voidedAt", "occurredAt");

-- DailyActivity (table "leads"): listing sorted by newest, filter by
-- eventType, and "assigned to me" sorted by newest.
CREATE INDEX IF NOT EXISTS "leads_created_at_idx"
  ON "leads" ("createdAt");

CREATE INDEX IF NOT EXISTS "leads_event_type_id_idx"
  ON "leads" ("eventTypeId");

CREATE INDEX IF NOT EXISTS "leads_assigned_to_id_created_at_idx"
  ON "leads" ("assignedToId", "createdAt");

-- Quotation: listing filters category + status, sorted by createdAt.
CREATE INDEX IF NOT EXISTS "quotations_category_status_created_at_idx"
  ON "quotations" ("category", "status", "createdAt");
