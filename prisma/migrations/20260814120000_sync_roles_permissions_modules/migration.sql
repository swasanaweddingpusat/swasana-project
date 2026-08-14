-- Consolidated role + permission + module-registry seed data.
-- Generated from prisma/seeders/roles-permissions.ts and prisma/seeders/modules.ts
-- so this migration is the single source of truth for RBAC baseline data.
-- Idempotent: safe to re-run (upserts + ON CONFLICT DO NOTHING).

-- 1. Roles
INSERT INTO "roles" ("id", "name", "description", "sortOrder", "isSystemRole", "createdAt") VALUES
  (gen_random_uuid(), 'super-admin', 'All Access', 1, true, NOW()),
  (gen_random_uuid(), 'direktur-sales', 'Access to sales data and customer management', 2, false, NOW()),
  (gen_random_uuid(), 'manager', 'Full access to all features and user management', 3, false, NOW()),
  (gen_random_uuid(), 'direktur-operational', 'All Access', 4, false, NOW()),
  (gen_random_uuid(), 'operational', 'All Access', 5, false, NOW()),
  (gen_random_uuid(), 'finance', 'Full finance access (AR + AP + cashflow + overview)', 6, false, NOW()),
  (gen_random_uuid(), 'finance-ar', 'Accounts Receivable + cashflow only', 13, false, NOW()),
  (gen_random_uuid(), 'finance-ap', 'Accounts Payable + expense + cashflow only', 14, false, NOW()),
  (gen_random_uuid(), 'sales', 'Access to sales data and customer management', 7, false, NOW()),
  (gen_random_uuid(), 'vendor-specialist', 'Manage Data Vendor Specialist', 8, false, NOW()),
  (gen_random_uuid(), 'human-resource', 'Access to human resource', 9, false, NOW()),
  (gen_random_uuid(), 'sales-mice', 'Sales access for MICE bookings', 10, false, NOW()),
  (gen_random_uuid(), 'manager-mice', 'Manager access for MICE features (leads, quotations, booking-mice)', 11, false, NOW()),
  (gen_random_uuid(), 'procurement-manager', 'Manage procurement requests and approvals', 12, false, NOW())
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "isSystemRole" = EXCLUDED."isSystemRole";

-- 2. Permission catalog (module + action)
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt") VALUES
  (gen_random_uuid(), 'booking', 'view', 0, NOW()),
  (gen_random_uuid(), 'booking', 'create', 0, NOW()),
  (gen_random_uuid(), 'booking', 'edit', 0, NOW()),
  (gen_random_uuid(), 'booking', 'delete', 0, NOW()),
  (gen_random_uuid(), 'booking', 'print', 0, NOW()),
  (gen_random_uuid(), 'booking', 'approve', 0, NOW()),
  (gen_random_uuid(), 'booking', 'mark-lost', 0, NOW()),
  (gen_random_uuid(), 'booking', 'restore', 0, NOW()),
  (gen_random_uuid(), 'booking', 'cancel', 0, NOW()),
  (gen_random_uuid(), 'booking', 'transfer', 0, NOW()),
  (gen_random_uuid(), 'booking', 'transfer-manager', 0, NOW()),
  (gen_random_uuid(), 'booking', 'reject', 0, NOW()),
  (gen_random_uuid(), 'booking', 'comment', 0, NOW()),
  (gen_random_uuid(), 'booking', 'client-agreement', 0, NOW()),
  (gen_random_uuid(), 'booking', 'term-&-condition', 0, NOW()),
  (gen_random_uuid(), 'booking', 'edit-package', 0, NOW()),
  (gen_random_uuid(), 'booking', 'edit-set-harga', 0, NOW()),
  (gen_random_uuid(), 'booking', 'reset-approval', 0, NOW()),
  (gen_random_uuid(), 'customers', 'view', 0, NOW()),
  (gen_random_uuid(), 'customers', 'create', 0, NOW()),
  (gen_random_uuid(), 'customers', 'edit', 0, NOW()),
  (gen_random_uuid(), 'customers', 'delete', 0, NOW()),
  (gen_random_uuid(), 'finance-ar', 'view', 0, NOW()),
  (gen_random_uuid(), 'finance-ar', 'create', 0, NOW()),
  (gen_random_uuid(), 'finance-ar', 'edit', 0, NOW()),
  (gen_random_uuid(), 'finance-ar', 'delete', 0, NOW()),
  (gen_random_uuid(), 'groups', 'view', 0, NOW()),
  (gen_random_uuid(), 'groups', 'view-all', 0, NOW()),
  (gen_random_uuid(), 'groups', 'create', 0, NOW()),
  (gen_random_uuid(), 'groups', 'edit', 0, NOW()),
  (gen_random_uuid(), 'groups', 'delete', 0, NOW()),
  (gen_random_uuid(), 'package', 'view', 0, NOW()),
  (gen_random_uuid(), 'package', 'create', 0, NOW()),
  (gen_random_uuid(), 'package', 'edit', 0, NOW()),
  (gen_random_uuid(), 'package', 'delete', 0, NOW()),
  (gen_random_uuid(), 'package', 'set-harga', 0, NOW()),
  (gen_random_uuid(), 'package', 'term-&-condition', 0, NOW()),
  (gen_random_uuid(), 'package', 'set-status', 0, NOW()),
  (gen_random_uuid(), 'vendor', 'view', 0, NOW()),
  (gen_random_uuid(), 'vendor', 'create', 0, NOW()),
  (gen_random_uuid(), 'vendor', 'edit', 0, NOW()),
  (gen_random_uuid(), 'vendor', 'delete', 0, NOW()),
  (gen_random_uuid(), 'vendor-specialist', 'view', 0, NOW()),
  (gen_random_uuid(), 'vendor-specialist', 'create', 0, NOW()),
  (gen_random_uuid(), 'vendor-specialist', 'edit', 0, NOW()),
  (gen_random_uuid(), 'vendor-specialist', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-brands', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-brands', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-brands', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-brands', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-venues', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-venues', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-venues', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-venues', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-users', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-users', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-users', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-users', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-education-level', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-education-level', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-education-level', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-education-level', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-event-types', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-event-types', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-event-types', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-event-types', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-order-status', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-order-status', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-order-status', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-order-status', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-payment-methods', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-payment-methods', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-payment-methods', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-payment-methods', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-quotation-templates', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-quotation-templates', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-quotation-templates', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-quotation-templates', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-role-permission', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-role-permission', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-role-permission', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-role-permission', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-source-of-information', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-source-of-information', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-source-of-information', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-source-of-information', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-tutorial', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-tutorial', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-tutorial', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-tutorial', 'delete', 0, NOW()),
  (gen_random_uuid(), 'complimentary', 'view', 0, NOW()),
  (gen_random_uuid(), 'complimentary', 'create', 0, NOW()),
  (gen_random_uuid(), 'complimentary', 'edit', 0, NOW()),
  (gen_random_uuid(), 'complimentary', 'delete', 0, NOW()),
  (gen_random_uuid(), 'daily-activity', 'view', 0, NOW()),
  (gen_random_uuid(), 'daily-activity', 'create', 0, NOW()),
  (gen_random_uuid(), 'daily-activity', 'edit', 0, NOW()),
  (gen_random_uuid(), 'daily-activity', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-lead-status', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-lead-status', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-lead-status', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-lead-status', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-daily-activity-segment', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-daily-activity-segment', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-daily-activity-segment', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-daily-activity-segment', 'delete', 0, NOW()),
  (gen_random_uuid(), 'quotations', 'view', 0, NOW()),
  (gen_random_uuid(), 'quotations', 'create', 0, NOW()),
  (gen_random_uuid(), 'quotations', 'edit', 0, NOW()),
  (gen_random_uuid(), 'quotations', 'delete', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'view', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'create', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'edit', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'delete', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'print', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'approve', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'mark-lost', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'restore', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'transfer', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'reject', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'comment', 0, NOW()),
  (gen_random_uuid(), 'booking-mice', 'client-agreement', 0, NOW()),
  (gen_random_uuid(), 'package-mice', 'view', 0, NOW()),
  (gen_random_uuid(), 'package-mice', 'create', 0, NOW()),
  (gen_random_uuid(), 'package-mice', 'edit', 0, NOW()),
  (gen_random_uuid(), 'package-mice', 'delete', 0, NOW()),
  (gen_random_uuid(), 'package-mice', 'set-harga', 0, NOW()),
  (gen_random_uuid(), 'package-mice', 'set-status', 0, NOW()),
  (gen_random_uuid(), 'maintenance', 'view', 0, NOW()),
  (gen_random_uuid(), 'maintenance', 'create', 0, NOW()),
  (gen_random_uuid(), 'maintenance', 'edit', 0, NOW()),
  (gen_random_uuid(), 'maintenance', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-category', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-category', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-category', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-category', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-priority', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-priority', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-priority', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-priority', 'delete', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-status', 'view', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-status', 'create', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-status', 'edit', 0, NOW()),
  (gen_random_uuid(), 'settings-maintenance-status', 'delete', 0, NOW()),
  (gen_random_uuid(), 'promo', 'view', 0, NOW()),
  (gen_random_uuid(), 'promo', 'create', 0, NOW()),
  (gen_random_uuid(), 'promo', 'edit', 0, NOW()),
  (gen_random_uuid(), 'promo', 'delete', 0, NOW()),
  (gen_random_uuid(), 'procurement', 'view', 0, NOW()),
  (gen_random_uuid(), 'procurement', 'create', 0, NOW()),
  (gen_random_uuid(), 'procurement', 'edit', 0, NOW()),
  (gen_random_uuid(), 'procurement', 'delete', 0, NOW()),
  (gen_random_uuid(), 'procurement', 'approve', 0, NOW()),
  (gen_random_uuid(), 'procurement-summary', 'view', 0, NOW()),
  (gen_random_uuid(), 'procurement-announcement', 'view', 0, NOW()),
  (gen_random_uuid(), 'procurement-announcement', 'create', 0, NOW()),
  (gen_random_uuid(), 'procurement-announcement', 'edit', 0, NOW()),
  (gen_random_uuid(), 'procurement-announcement', 'delete', 0, NOW()),
  (gen_random_uuid(), 'procurement-budget', 'view', 0, NOW()),
  (gen_random_uuid(), 'procurement-budget', 'create', 0, NOW()),
  (gen_random_uuid(), 'procurement-budget', 'edit', 0, NOW()),
  (gen_random_uuid(), 'procurement-budget', 'delete', 0, NOW()),
  (gen_random_uuid(), 'guestbook', 'view', 0, NOW()),
  (gen_random_uuid(), 'guestbook', 'create', 0, NOW()),
  (gen_random_uuid(), 'guestbook', 'edit', 0, NOW()),
  (gen_random_uuid(), 'bitrix', 'view', 0, NOW()),
  (gen_random_uuid(), 'hr', 'view', 0, NOW()),
  (gen_random_uuid(), 'hr', 'create', 0, NOW()),
  (gen_random_uuid(), 'hr', 'edit', 0, NOW()),
  (gen_random_uuid(), 'hr', 'delete', 0, NOW()),
  (gen_random_uuid(), 'hr', 'approve', 0, NOW()),
  (gen_random_uuid(), 'hr-recruitment', 'view', 0, NOW()),
  (gen_random_uuid(), 'hr-recruitment', 'create', 0, NOW()),
  (gen_random_uuid(), 'hr-recruitment', 'edit', 0, NOW()),
  (gen_random_uuid(), 'hr-recruitment', 'delete', 0, NOW()),
  (gen_random_uuid(), 'hr-recruitment', 'hire', 0, NOW()),
  (gen_random_uuid(), 'finance-ap', 'view', 0, NOW()),
  (gen_random_uuid(), 'finance-ap', 'create', 0, NOW()),
  (gen_random_uuid(), 'finance-ap', 'edit', 0, NOW()),
  (gen_random_uuid(), 'finance-ap', 'delete', 0, NOW())
ON CONFLICT ("module", "action") DO NOTHING;

-- 3. Module registry (sidebar worlds) + permission maps
INSERT INTO "modules" ("id", "key", "name", "icon", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('mod_finance', 'finance', 'Finance', 'Wallet', 10, true, NOW(), NOW()),
  ('mod_hrd', 'hrd', 'HRD', 'UsersGroupRounded', 20, true, NOW(), NOW()),
  ('mod_booking', 'booking', 'Booking', 'TicketSale', 30, true, NOW(), NOW()),
  ('mod_purchase', 'purchase', 'Purchase', 'CartLarge', 40, true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "icon" = EXCLUDED."icon",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = EXCLUDED."isActive";

INSERT INTO "module_permission_maps" ("id", "moduleId", "permissionModule") VALUES
  (gen_random_uuid(), 'mod_finance', 'finance-ar'),
  (gen_random_uuid(), 'mod_finance', 'finance-ap'),
  (gen_random_uuid(), 'mod_hrd', 'hr'),
  (gen_random_uuid(), 'mod_hrd', 'hr-recruitment'),
  (gen_random_uuid(), 'mod_booking', 'booking'),
  (gen_random_uuid(), 'mod_booking', 'booking-mice'),
  (gen_random_uuid(), 'mod_booking', 'groups'),
  (gen_random_uuid(), 'mod_booking', 'daily-activity'),
  (gen_random_uuid(), 'mod_booking', 'quotations'),
  (gen_random_uuid(), 'mod_booking', 'package'),
  (gen_random_uuid(), 'mod_booking', 'package-mice'),
  (gen_random_uuid(), 'mod_booking', 'complimentary'),
  (gen_random_uuid(), 'mod_booking', 'promo'),
  (gen_random_uuid(), 'mod_purchase', 'vendor-specialist')
ON CONFLICT ("moduleId", "permissionModule") DO NOTHING;

DELETE FROM "module_permission_maps" WHERE "moduleId" = 'mod_finance' AND "permissionModule" NOT IN ('finance-ar', 'finance-ap');
DELETE FROM "module_permission_maps" WHERE "moduleId" = 'mod_hrd' AND "permissionModule" NOT IN ('hr', 'hr-recruitment');
DELETE FROM "module_permission_maps" WHERE "moduleId" = 'mod_booking' AND "permissionModule" NOT IN ('booking', 'booking-mice', 'groups', 'daily-activity', 'quotations', 'package', 'package-mice', 'complimentary', 'promo');
DELETE FROM "module_permission_maps" WHERE "moduleId" = 'mod_purchase' AND "permissionModule" NOT IN ('vendor-specialist');

-- 4. super-admin → all permissions (wipe + re-grant)
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'super-admin');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'super-admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 5. Role → permission matrix (wipe + re-grant per role)
-- direktur-sales
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'direktur-sales');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'booking'
  AND p."action" IN ('view', 'create', 'edit', 'approve', 'mark-lost', 'transfer', 'transfer-manager', 'comment', 'print', 'client-agreement')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'customers'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'groups'
  AND p."action" IN ('view', 'view-all', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'package'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'vendor'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'finance-ar'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'daily-activity'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'settings-lead-status'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'settings-daily-activity-segment'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'quotations'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'settings-quotation-templates'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'complimentary'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'promo'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-sales'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- manager
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'manager');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'booking'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'print', 'approve', 'mark-lost', 'restore', 'cancel', 'transfer', 'reject', 'comment', 'client-agreement', 'edit-package', 'edit-set-harga')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'customers'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'groups'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'daily-activity'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'package'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'set-harga', 'term-&-condition', 'set-status')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'vendor'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'complimentary'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'promo'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'approve')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'procurement-summary'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'procurement-announcement'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'procurement-budget'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'hr'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'approve')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- direktur-operational
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'direktur-operational');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'booking'
  AND p."action" IN ('view', 'create', 'edit', 'approve', 'comment', 'print')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'customers'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'package'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'vendor'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'maintenance'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'promo'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'approve')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'procurement-summary'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'procurement-announcement'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'procurement-budget'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'direktur-operational'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- operational
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'operational');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'procurement-summary'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'procurement-announcement'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'procurement-budget'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'vendor'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'vendor-specialist'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'operational'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- finance
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'finance');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance'
  AND p."module" = 'finance-ar'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance'
  AND p."module" = 'finance-ap'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- finance-ar
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'finance-ar');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ar'
  AND p."module" = 'finance-ar'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ar'
  AND p."module" = 'booking'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ar'
  AND p."module" = 'customers'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ar'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- finance-ap
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'finance-ap');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ap'
  AND p."module" = 'finance-ap'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ap'
  AND p."module" = 'booking'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ap'
  AND p."module" = 'customers'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'finance-ap'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- sales
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'sales');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'booking'
  AND p."action" IN ('view', 'create', 'edit', 'comment', 'client-agreement', 'print')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'customers'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'groups'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'package'
  AND p."action" IN ('view', 'create', 'edit', 'term-&-condition')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'vendor'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'settings-source-of-information'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'complimentary'
  AND p."action" IN ('view', 'create')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'promo'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- vendor-specialist
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'vendor-specialist');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'vendor-specialist'
  AND p."module" = 'vendor-specialist'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'vendor-specialist'
  AND p."module" = 'vendor'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'vendor-specialist'
  AND p."module" = 'booking'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'vendor-specialist'
  AND p."module" = 'package'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- human-resource
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'human-resource');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'hr'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'approve')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'hr-recruitment'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'hire')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'procurement'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'settings-users'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'settings-education-level'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'human-resource'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- sales-mice
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'sales-mice');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'booking-mice'
  AND p."action" IN ('view', 'create', 'edit', 'comment', 'client-agreement')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'customers'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'vendor'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'quotations'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'daily-activity'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'complimentary'
  AND p."action" IN ('view', 'create')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'settings-daily-activity-segment'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'guestbook'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'package-mice'
  AND p."action" IN ('view', 'create', 'edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'sales-mice'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- manager-mice
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'manager-mice');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'booking-mice'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'print', 'approve', 'mark-lost', 'restore', 'transfer', 'reject', 'comment', 'client-agreement')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'daily-activity'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'quotations'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'groups'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'customers'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'settings-event-types'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'settings-quotation-templates'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'settings-daily-activity-segment'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'package-mice'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'set-harga', 'set-status')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'bitrix'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- procurement-manager
DELETE FROM "role_permissions" WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'procurement-manager');
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'procurement-manager'
  AND p."module" = 'procurement'
  AND p."action" IN ('view', 'create', 'edit', 'delete', 'approve')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'procurement-manager'
  AND p."module" = 'procurement-summary'
  AND p."action" IN ('view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'procurement-manager'
  AND p."module" = 'procurement-announcement'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'procurement-manager'
  AND p."module" = 'procurement-budget'
  AND p."action" IN ('view', 'create', 'edit', 'delete')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 6. Universal force-grants (applied to ALL roles)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE p."module" = 'booking' AND p."action" = 'term-&-condition'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE p."module" = 'booking' AND p."action" = 'edit-package'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
