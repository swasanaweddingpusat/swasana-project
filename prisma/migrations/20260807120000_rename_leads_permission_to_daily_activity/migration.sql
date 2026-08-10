-- Rename the CRM permission module "leads" → "daily-activity".
-- The feature formerly called "Leads" is now "Daily Activity" across the whole stack;
-- this migration moves the permission module (and every role grant on it) to the new name.
-- Strategy (idempotent, re-runnable): INSERT new module rows → copy role_permissions from
-- old → new → DELETE old rows (role_permissions cascade via FK ON DELETE CASCADE).

-- ── 1. Insert daily-activity permissions (one row per action) ────────────────
INSERT INTO "permissions" ("id","module","action","moduleSortOrder","createdAt")
SELECT gen_random_uuid()::text, 'daily-activity', a.action, 0, now()
FROM (VALUES ('view'), ('create'), ('edit'), ('delete')) AS a(action)
ON CONFLICT ("module","action") DO NOTHING;

-- ── 2. Copy every existing role grant on "leads" → matching "daily-activity" ──
-- Match old→new permission by action, transfer the grant to the same role.
INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid()::text, rp."roleId", np.id, now()
FROM "role_permissions" rp
JOIN "permissions" op ON rp."permissionId" = op.id AND op.module = 'leads'
JOIN "permissions" np ON np.module = 'daily-activity' AND np.action = op.action
ON CONFLICT ("roleId","permissionId") DO NOTHING;

-- ── 3. Remove the old "leads" module (role_permissions cascade on FK delete) ──
DELETE FROM "permissions" WHERE module = 'leads';
