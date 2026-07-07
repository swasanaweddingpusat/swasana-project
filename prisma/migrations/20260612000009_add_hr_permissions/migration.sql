-- Seed hr permission module (view, create, edit, delete, approve)
INSERT INTO "permissions" (id, module, action) VALUES
  (gen_random_uuid()::text, 'hr', 'view'),
  (gen_random_uuid()::text, 'hr', 'create'),
  (gen_random_uuid()::text, 'hr', 'edit'),
  (gen_random_uuid()::text, 'hr', 'delete'),
  (gen_random_uuid()::text, 'hr', 'approve')
ON CONFLICT (module, action) DO NOTHING;

-- Assign all hr permissions to human-resource role
DO $$
DECLARE
  hr_role_id text;
BEGIN
  SELECT id INTO hr_role_id FROM "roles" WHERE name = 'human-resource';
  IF hr_role_id IS NULL THEN
    RAISE NOTICE 'human-resource role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), hr_role_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'hr'
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;

-- Assign all hr permissions to manager role
DO $$
DECLARE
  mgr_id text;
BEGIN
  SELECT id INTO mgr_id FROM "roles" WHERE name = 'manager';
  IF mgr_id IS NULL THEN
    RAISE NOTICE 'manager role not found — skipping';
    RETURN;
  END IF;

  INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
  SELECT gen_random_uuid(), mgr_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = 'hr'
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;
