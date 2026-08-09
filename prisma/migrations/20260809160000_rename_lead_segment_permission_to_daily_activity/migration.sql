-- Rename the settings permission module "settings-lead-segment" → "settings-daily-activity-segment".
-- The MICE segment master data now lives under the Daily Activity feature; this migration moves
-- the permission module (and every role grant on it) to the new name.
-- Strategy (idempotent, re-runnable): INSERT new module rows → copy role_permissions from
-- old → new → DELETE old rows (role_permissions cascade via FK ON DELETE CASCADE).
--
-- NOTE: the physical table "lead_segments" is intentionally KEPT (Prisma model renamed to
-- DailyActivitySegment via @@map). No data migration on segment rows here.

-- ── 1. Insert settings-daily-activity-segment permissions (one row per action) ──
INSERT INTO "permissions" ("id","module","action","moduleSortOrder","createdAt")
SELECT gen_random_uuid()::text, 'settings-daily-activity-segment', a.action, 0, now()
FROM (VALUES ('view'), ('create'), ('edit'), ('delete')) AS a(action)
ON CONFLICT ("module","action") DO NOTHING;

-- ── 2. Copy every existing role grant on old → new module ────────────────────
INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid()::text, rp."roleId", np.id, now()
FROM "role_permissions" rp
JOIN "permissions" op ON rp."permissionId" = op.id AND op.module = 'settings-lead-segment'
JOIN "permissions" np ON np.module = 'settings-daily-activity-segment' AND np.action = op.action
ON CONFLICT ("roleId","permissionId") DO NOTHING;

-- ── 3. Remove the old module (role_permissions cascade on FK delete) ─────────
DELETE FROM "permissions" WHERE module = 'settings-lead-segment';

-- ── 4. Clean up duplicate segment rows accidentally introduced by a reverted
--        seed attempt (20260809150000). "Coorporate" and "Star up" are the
--        canonical spellings already present; drop the deduped variants only if
--        no activity references them (segmentId FK is ON DELETE SET NULL, but we
--        guard anyway to avoid nulling a real reference).
DELETE FROM "lead_segments" ls
WHERE ls."name" IN ('Corporate', 'Start up')
  AND NOT EXISTS (
    SELECT 1 FROM "leads" da WHERE da."segmentId" = ls."id"
  );
