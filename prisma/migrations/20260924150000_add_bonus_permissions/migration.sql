-- The bonus module shipped with API routes and a picker guarded by
-- `bonus:view`, but its permission rows were never seeded. With no row to match,
-- every role — super-admin included — failed the check, so /api/bonuses returned
-- 403 and the Compliment & Bonus step rendered "Belum ada bonus." despite the
-- master data existing.
--
-- Mirrors prisma/seeders/roles-permissions.ts: same four actions and the same
-- per-role grants already used by the sibling `complimentary` module.
--
-- Written to be re-runnable: every statement skips rows that already exist and
-- only grants roles that are actually present, so applying this on a database
-- that was already fixed by hand is a no-op rather than a duplicate-key failure.

INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
SELECT gen_random_uuid(), 'bonus', a.action, 0, NOW()
FROM (VALUES ('view'), ('create'), ('edit'), ('delete')) AS a(action)
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" existing
  WHERE existing."module" = 'bonus' AND existing."action" = a.action
)
ON CONFLICT ("module", "action") DO NOTHING;

-- Full CRUD for the roles that manage the bonus catalogue.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."module" = 'bonus'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
  AND (
    r."isSystemRole" = true
    OR r."name" IN ('direktur-sales', 'manager', 'sales', 'sales-mice', 'manager-mice')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" granted
    WHERE granted."roleId" = r."id" AND granted."permissionId" = p."id"
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Finance only reads and creates bonuses.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."module" = 'bonus'
  AND p."action" IN ('view', 'create')
  AND r."name" = 'finance'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" granted
    WHERE granted."roleId" = r."id" AND granted."permissionId" = p."id"
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
