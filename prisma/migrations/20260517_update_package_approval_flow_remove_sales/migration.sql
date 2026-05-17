-- Remove sales step from package approval flow
-- New flow: manager (step 1) → finance (step 2)

DO $$
DECLARE
  flow_id TEXT;
  manager_role_id TEXT;
  finance_role_id TEXT;
BEGIN
  -- Get the package approval flow id
  SELECT id INTO flow_id FROM "approval_flows" WHERE module = 'package' LIMIT 1;
  IF flow_id IS NULL THEN RETURN; END IF;

  -- Get role ids
  SELECT id INTO manager_role_id FROM "roles" WHERE name = 'manager' LIMIT 1;
  SELECT id INTO finance_role_id FROM "roles" WHERE name = 'finance' LIMIT 1;

  -- Delete all existing steps for this flow
  DELETE FROM "approval_flow_steps" WHERE "flowId" = flow_id;

  -- Insert new steps: manager (1) + finance (2) only
  IF manager_role_id IS NOT NULL THEN
    INSERT INTO "approval_flow_steps" (id, "flowId", "sortOrder", "approverType", "approverRoleId", "approverUserId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, flow_id, 1, 'role', manager_role_id, NULL, NOW(), NOW());
  END IF;

  IF finance_role_id IS NOT NULL THEN
    INSERT INTO "approval_flow_steps" (id, "flowId", "sortOrder", "approverType", "approverRoleId", "approverUserId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, flow_id, 2, 'role', finance_role_id, NULL, NOW(), NOW());
  END IF;
END $$;
