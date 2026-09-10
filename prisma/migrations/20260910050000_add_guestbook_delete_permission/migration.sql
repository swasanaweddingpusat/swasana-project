-- Add guestbook:delete permission (idempotent)
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
VALUES (gen_random_uuid()::text, 'guestbook', 'delete', 0, now())
ON CONFLICT ("module", "action") DO NOTHING;

-- Grant guestbook:delete to ONLY the 6 roles that already have guestbook edit (idempotent)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."module" = 'guestbook'
  AND p."action" = 'delete'
  AND r."name" IN ('direktur-sales', 'manager', 'direktur-operational', 'operational', 'sales', 'sales-mice')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
