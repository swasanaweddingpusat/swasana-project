-- Remove dead daily-activity permissions and world-mapping.
-- Mirrors the seeder cleanup in commit 8c0b07b so a deploy (prisma migrate deploy)
-- auto-applies the same removal to existing DBs (staging/prod) — seeders do not run on deploy.
--
-- SCOPE: data-only. schema.prisma is unchanged. NO booking tables touched.
-- KEPT INTENTIONALLY: the `daily-activity` permission ROWS themselves stay — the
--   booking/quotation lead-search API (GET /api/daily-activity) authorizes via
--   requirePermissionForRoute({ module: "daily-activity" }). Only the two dead
--   settings permissions and the booking-world mapping are removed.

-- 1) Drop the two dead settings permissions (UI removed, no live route).
--    role_permissions rows referencing these cascade automatically via the
--    RolePermission.permissionId FK (onDelete: Cascade).
DELETE FROM "permissions"
WHERE "module" IN ('settings-lead-status', 'settings-daily-activity-segment');

-- 2) Unmap `daily-activity` from the Booking world switcher (mirrors modules.ts).
--    This is the module_permission_maps row, cascade-safe and idempotent.
DELETE FROM "module_permission_maps"
WHERE "moduleId" = 'mod_booking' AND "permissionModule" = 'daily-activity';
