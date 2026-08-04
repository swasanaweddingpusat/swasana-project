-- Create lead_segments master table for MICE segment/category.
-- Idempotent: safe to run multiple times.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "lead_segments" (
    "id"        TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "isActive"  BOOLEAN     NOT NULL DEFAULT true,
    "sortOrder" INTEGER     NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lead_segments_sortOrder_idx" ON "lead_segments"("sortOrder");

-- ─── Seed default segments ───────────────────────────────────────────────────
-- Use WHERE NOT EXISTS on name to prevent duplicate rows on re-run
-- (name is not unique in schema, so ON CONFLICT (name) would fail).

INSERT INTO "lead_segments" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Government', true, 0, now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM "lead_segments" WHERE "name" = 'Government'
);

INSERT INTO "lead_segments" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Banking', true, 1, now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM "lead_segments" WHERE "name" = 'Banking'
);

-- ─── Seed permissions ────────────────────────────────────────────────────────

INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
SELECT gen_random_uuid(), m.module, a.action, 0, now()
FROM (VALUES ('settings-lead-segment')) AS m(module)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS a(action)
ON CONFLICT ("module", "action") DO NOTHING;

-- ─── Grant to super-admin (all permissions) ──────────────────────────────────

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."isSystemRole" = true
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ─── Grant settings-lead-segment to manager + direktur-sales ─────────────────

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r.id, p.id, now()
FROM "roles" r
JOIN "permissions" p
  ON  p.module = 'settings-lead-segment'
  AND p.action = ANY (ARRAY['view', 'create', 'edit', 'delete'])
WHERE r.name = ANY (ARRAY['manager', 'direktur-sales'])
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
