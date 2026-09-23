-- Remove invalid empty-string defaults from KPI primary keys. Prisma generates
-- cuid values client-side; a database default of '' can cause duplicate keys.
ALTER TABLE "kpi_target_items" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_achievement_schemas" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_achievement_tiers" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_masters" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_commission_policies" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_assignments" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_policy_snapshots" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_calculation_results" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "kpi_calculation_details" ALTER COLUMN "id" DROP DEFAULT;

-- Keep the JSON default explicit and canonical for Prisma introspection.
ALTER TABLE "wedding_indicators"
  ALTER COLUMN "questionnaireData" SET DEFAULT '{}'::jsonb;

-- The one-to-one constraint already creates a unique index, but this named
-- index is declared in schema.prisma and retained for migration consistency.
CREATE INDEX IF NOT EXISTS "snap_quotation_packages_quotationId_idx"
  ON "snap_quotation_packages"("quotationId");
