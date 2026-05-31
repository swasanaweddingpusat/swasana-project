-- Realign permission modules:
--   • Ensure CRM modules (leads, quotations, settings-lead-status) exist as permissions.
--   • Remove dead modules: "approval" (approve/reject now gated by role-matching in the
--     hardcoded approval flow) and "settings-approval-flow" (flow is hardcoded in code).
-- Idempotent: safe to run multiple times.

-- ── 1. Insert CRM permissions (one row per action) ───────────────────────────
INSERT INTO "permissions" ("id","module","action","moduleSortOrder","createdAt")
SELECT gen_random_uuid(), m.module, a.action, 0, now()
FROM (VALUES ('leads'), ('quotations'), ('settings-lead-status')) AS m(module)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS a(action)
ON CONFLICT ("module","action") DO NOTHING;

-- ── 2. Super-admin gets ALL permissions ──────────────────────────────────────
INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'super-admin'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

-- ── 3. Grant CRM modules to manager / direktur-sales / sales / sales-mice ─────
-- manager + direktur-sales: full CRUD on leads & quotations; manager also settings-lead-status
INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p
  ON  p.module = ANY (ARRAY['leads','quotations'])
  AND p.action = ANY (ARRAY['view','create','edit','delete'])
WHERE r.name = ANY (ARRAY['manager','direktur-sales'])
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p
  ON  p.module = 'settings-lead-status'
  AND p.action = ANY (ARRAY['view','create','edit','delete'])
WHERE r.name = ANY (ARRAY['manager','direktur-sales'])
ON CONFLICT ("roleId","permissionId") DO NOTHING;

-- sales + sales-mice: view/create/edit on leads (sales only) & quotations
INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p
  ON  p.module = 'quotations'
  AND p.action = ANY (ARRAY['view','create','edit'])
WHERE r.name = ANY (ARRAY['sales','sales-mice'])
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p
  ON  p.module = 'leads'
  AND p.action = ANY (ARRAY['view','create','edit'])
WHERE r.name = 'sales'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

-- ── 4. Remove dead modules (role_permissions cascade via FK ON DELETE CASCADE) ─
DELETE FROM "permissions"
WHERE module = ANY (ARRAY['approval','settings-approval-flow']);
