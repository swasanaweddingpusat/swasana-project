-- Add new groups:* permissions
INSERT INTO "permissions" (id, module, action) VALUES
  (gen_random_uuid()::text, 'groups', 'view'),
  (gen_random_uuid()::text, 'groups', 'view-all'),
  (gen_random_uuid()::text, 'groups', 'create'),
  (gen_random_uuid()::text, 'groups', 'edit'),
  (gen_random_uuid()::text, 'groups', 'delete')
ON CONFLICT (module, action) DO NOTHING;

-- Migrate role_permissions: my-team:* → groups:*
INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, rp."roleId", new_p.id
FROM "role_permissions" rp
JOIN "permissions" old_p ON rp."permissionId" = old_p.id AND old_p.module = 'my-team'
JOIN "permissions" new_p ON new_p.module = 'groups' AND new_p.action = old_p.action
ON CONFLICT DO NOTHING;

-- Migrate role_permissions: settings-groups:* → groups:* (view, create, edit, delete)
INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, rp."roleId", new_p.id
FROM "role_permissions" rp
JOIN "permissions" old_p ON rp."permissionId" = old_p.id AND old_p.module = 'settings-groups'
JOIN "permissions" new_p ON new_p.module = 'groups' AND new_p.action = old_p.action
ON CONFLICT DO NOTHING;

-- Remove old role_permissions rows first
DELETE FROM "role_permissions"
WHERE "permissionId" IN (
  SELECT id FROM "permissions" WHERE module IN ('my-team', 'settings-groups')
);

-- Remove old permissions
DELETE FROM "permissions" WHERE module IN ('my-team', 'settings-groups');
