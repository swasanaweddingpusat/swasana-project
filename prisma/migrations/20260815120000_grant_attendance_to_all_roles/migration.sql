-- Grant attendance:view to ALL roles.
-- Absensi is a GENERAL menu (all roles can clock in/out); `attendance` is a
-- dedicated permission so granting it does NOT unlock the HRD world (hr:view).

-- 1. Ensure the permission exists.
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
VALUES (gen_random_uuid(), 'attendance', 'view', 0, NOW())
ON CONFLICT ("module", "action") DO NOTHING;

-- 2. Grant to every role (idempotent).
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE p."module" = 'attendance' AND p."action" = 'view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
