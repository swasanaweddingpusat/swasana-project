-- Restrict leads:delete to super-admin & manager only.
-- Manager already has it (granted in 20260531120000). Super-admin bypasses all checks.
-- Here we REVOKE leads:delete from any non-manager role that may have inherited it
-- from older seeds (notably direktur-sales).
-- Idempotent: re-running is a no-op once the grants are gone.

DELETE FROM "role_permissions" rp
USING "permissions" p, "roles" r
WHERE rp."permissionId" = p.id
  AND rp."roleId" = r.id
  AND p.module = 'leads'
  AND p.action = 'delete'
  AND r.name <> 'manager'
  AND r."isSystemRole" = false;
