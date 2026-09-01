-- Composite indexes for dashboard read paths (stat cards, group performance,
-- sales performance). These queries filter recordStatus = 'saved' AND a
-- dealing-date (createdAt) or event-date (eventDate) range, often further
-- scoped by salesId. The previous single-column indexes forced a large scan.
-- Idempotent — safe to run multiple times.
CREATE INDEX IF NOT EXISTS "bookings_record_status_created_at_idx"
  ON "bookings" ("recordStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "bookings_record_status_event_date_idx"
  ON "bookings" ("recordStatus", "eventDate");

CREATE INDEX IF NOT EXISTS "bookings_record_status_sales_id_idx"
  ON "bookings" ("recordStatus", "salesId");
