-- Add booking:term-&-condition permission and grant it to ALL roles.
-- This permission is intentionally universal — every role may edit a booking's
-- Term & Condition. Idempotent: safe to run multiple times.

-- 1. Create the permission (no-op if it already exists)
INSERT INTO "permissions" (id, module, action)
VALUES (gen_random_uuid()::text, 'booking', 'term-&-condition')
ON CONFLICT (module, action) DO NOTHING;

-- 2. Grant it to every existing role (no-op for roles that already have it)
INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p.module = 'booking' AND p.action = 'term-&-condition'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
