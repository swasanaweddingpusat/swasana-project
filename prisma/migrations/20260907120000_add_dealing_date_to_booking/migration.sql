-- Add booking:dealing-date permission.
-- Gates the ability to edit a booking's createdAt ("dealing date") in the edit form.
-- Intentionally NOT auto-granted to any role — super-admin bypasses via isSystemRole;
-- assign to other roles manually via Settings if ever needed.
-- Idempotent: safe to run multiple times.

INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt")
VALUES (gen_random_uuid()::text, 'booking', 'dealing-date', 0, now())
ON CONFLICT ("module", "action") DO NOTHING;
