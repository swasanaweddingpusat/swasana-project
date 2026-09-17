-- Holiday-token leave requests: a "token" is just an active LeaveRequest that
-- references a PublicHoliday. No new ledger table — see
-- docs plan "Token Libur Hari Besar" for the model. publicHolidayName is a
-- snapshot (same pattern as attendances.publicHolidayName) so the request keeps
-- showing the holiday's name even if the master row is renamed or removed.

ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "publicHolidayId" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "publicHolidayName" TEXT;

CREATE INDEX IF NOT EXISTS "leave_requests_publicHolidayId_idx" ON "leave_requests"("publicHolidayId");

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_publicHolidayId_fkey" FOREIGN KEY ("publicHolidayId") REFERENCES "public_holidays"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the "Libur Hari Besar" (holiday token) leave type. isDeductible=false so the
-- LeaveBalance year-aggregate path is bypassed entirely for this type; a token's
-- availability is derived from active PublicHoliday rows minus this profile's active
-- holiday-token requests, not from a balance table.
INSERT INTO "leave_types" (id, name, code, description, "defaultQuota", "isDeductible", "requiresApproval", "maxConsecutiveDays", "minDaysBeforeRequest", "isCarryOver", "carryOverMaxDays", "isActive", "isSystemType", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Libur Hari Besar', 'public_holiday', 'Tukar hari besar dengan tanggal libur bebas (token per hari besar aktif)', 0, false, true, 1, 0, false, NULL, true, true, 9, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
