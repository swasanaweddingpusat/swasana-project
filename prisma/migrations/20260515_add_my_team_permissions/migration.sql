-- Seed my-team permission module
INSERT INTO "permissions" (id, module, action)
VALUES
  (gen_random_uuid()::text, 'my-team', 'view'),
  (gen_random_uuid()::text, 'my-team', 'create'),
  (gen_random_uuid()::text, 'my-team', 'edit'),
  (gen_random_uuid()::text, 'my-team', 'delete'),
  (gen_random_uuid()::text, 'my-team', 'view-all')
ON CONFLICT (module, action) DO NOTHING;
