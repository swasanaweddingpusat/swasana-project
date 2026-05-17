-- Add vendor-specialist permissions
INSERT INTO "permissions" (id, module, action) VALUES
  (gen_random_uuid()::text, 'vendor-specialist', 'view'),
  (gen_random_uuid()::text, 'vendor-specialist', 'create'),
  (gen_random_uuid()::text, 'vendor-specialist', 'edit'),
  (gen_random_uuid()::text, 'vendor-specialist', 'delete')
ON CONFLICT (module, action) DO NOTHING;
