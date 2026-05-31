-- Sync the "manager" role to spec: full access to every module EXCEPT settings-*.
-- Manager previously inherited settings-* grants from older seeds; this realigns it.
-- Deterministic: wipe manager's role_permissions, then re-insert the canonical set.
-- Idempotent: re-running yields the same final state.

DO $$
DECLARE
  mgr_id text;
BEGIN
  SELECT id INTO mgr_id FROM "roles" WHERE name = 'manager';
  IF mgr_id IS NULL THEN
    RAISE NOTICE 'manager role not found — skipping';
    RETURN;
  END IF;

  -- 1. Clear all existing manager grants
  DELETE FROM "role_permissions" WHERE "roleId" = mgr_id;

  -- 2. Re-insert canonical manager permissions (all non-settings modules, full actions)
  INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
  SELECT gen_random_uuid(), mgr_id, p.id, now()
  FROM "permissions" p
  WHERE p.module = ANY (ARRAY[
    'booking','booking-mice','customers','finance-ar','groups',
    'package','vendor','vendor-specialist','leads','quotations'
  ])
  ON CONFLICT ("roleId","permissionId") DO NOTHING;
END $$;
