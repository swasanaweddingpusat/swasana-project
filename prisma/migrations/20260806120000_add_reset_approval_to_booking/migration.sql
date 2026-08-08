-- Add booking:reset-approval permission.
-- This permission is intentionally NOT auto-granted to any role — assign manually via UI.
-- Idempotent: safe to run multiple times.

INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
VALUES (gen_random_uuid()::text, 'booking', 'reset-approval', 0, now())
ON CONFLICT ("module", "action") DO NOTHING;
