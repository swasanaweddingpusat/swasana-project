-- Migration: add_module_status_index_to_approval_records
-- Adds a composite index on (module, status) to approval_records so the
-- approvalStatus filter query (WHERE module = 'booking' AND status = 'approved')
-- can use an index instead of a sequential scan. The existing @@unique([module,
-- entityId]) already covers the page-scoped (module + entityId IN (...)) lookup.

-- Add index (idempotent)
CREATE INDEX IF NOT EXISTS "approval_records_module_status_idx" ON "approval_records"("module", "status");
