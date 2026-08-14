-- Grant the HRD role (`human-resource`) two menu areas it was missing:
--   • Rekrutmen & Onboarding  → hr-recruitment (view/create/edit/delete/hire)
--   • Procurement             → procurement    (view/create/edit/delete)
--
-- Both permission catalogs already exist (seeded by 20260622180000 and
-- 20260711000000 respectively). This only assigns them to the role. Idempotent
-- via ON CONFLICT so re-running deploy is safe.
--
-- NOTE: procurement:view surfaces ALL four Purchase→Procurement sub-tabs
-- (Pengadaan/Ringkasan/Pengumuman/Anggaran Venue) because they share one gate,
-- plus the Purchase module world. Scoping HRD to only the "Pengadaan" tab needs
-- the permission split per sub-tab and is deliberately out of scope here.

-- hr-recruitment → human-resource (all actions incl. hire)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'hr-recruitment'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- procurement → human-resource (CRUD; approve intentionally excluded)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
