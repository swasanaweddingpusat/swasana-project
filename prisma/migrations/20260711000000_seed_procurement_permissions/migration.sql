-- Seed procurement permission rows (idempotent)
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
VALUES
  (gen_random_uuid(), 'procurement', 'view',    0, NOW()),
  (gen_random_uuid(), 'procurement', 'create',  0, NOW()),
  (gen_random_uuid(), 'procurement', 'edit',    0, NOW()),
  (gen_random_uuid(), 'procurement', 'delete',  0, NOW()),
  (gen_random_uuid(), 'procurement', 'approve', 0, NOW())
ON CONFLICT ("module", "action") DO NOTHING;

-- Assign procurement permissions to super-admin (isSystemRole = true)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."isSystemRole" = true
  AND p."module" = 'procurement'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign all procurement actions to manager
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'procurement'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign all procurement actions to procurement-manager
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'procurement-manager'
  AND p."module" = 'procurement'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- direktur-operational: view + approve only
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'approve')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- operational: view + create only
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'create')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
