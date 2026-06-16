-- Drop periode columns from user_targets (target sales jadi amount tunggal tanpa periode)
DROP INDEX IF EXISTS "user_targets_type_startDate_endDate_idx";
ALTER TABLE "user_targets" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "user_targets" DROP COLUMN IF EXISTS "endDate";
CREATE INDEX IF NOT EXISTS "user_targets_type_idx" ON "user_targets"("type");
