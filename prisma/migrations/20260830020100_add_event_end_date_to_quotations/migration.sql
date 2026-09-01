-- Migration: add_event_end_date_to_quotations
-- MICE Quotation "Tanggal Event" can now be a single date OR a date range.
-- eventDate stays the (logically required) start date; eventEndDate is the
-- optional end date. NULL eventEndDate on existing rows = single-date
-- quotations, rendered exactly as before. Idempotent — safe to run multiple
-- times.

ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "eventEndDate" TIMESTAMP(3);
