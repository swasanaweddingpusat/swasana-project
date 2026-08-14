CREATE TABLE IF NOT EXISTS "modules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "modules_key_key" ON "modules"("key");

CREATE TABLE IF NOT EXISTS "module_permission_maps" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "permissionModule" TEXT NOT NULL,
    CONSTRAINT "module_permission_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "module_permission_maps_moduleId_permissionModule_key"
    ON "module_permission_maps"("moduleId", "permissionModule");

DO $$ BEGIN
    ALTER TABLE "module_permission_maps"
        ADD CONSTRAINT "module_permission_maps_moduleId_fkey"
        FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed modules (stable ids so mapping inserts are deterministic)
INSERT INTO "modules" ("id", "key", "name", "icon", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
    ('mod_finance',  'finance',  'Finance',  'Wallet',    10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('mod_hrd',      'hrd',      'HRD',      'UsersGroupRounded', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('mod_booking',  'booking',  'Booking',  'TicketSale', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('mod_purchase', 'purchase', 'Purchase', 'CartLarge',  40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Seed mappings
INSERT INTO "module_permission_maps" ("id", "moduleId", "permissionModule") VALUES
    ('mpm_fin_ar',  'mod_finance',  'finance-ar'),
    ('mpm_fin_ap',  'mod_finance',  'finance-ap'),
    ('mpm_hrd_hr',  'mod_hrd',      'hr'),
    ('mpm_hrd_rec', 'mod_hrd',      'hr-recruitment'),
    ('mpm_bk_bk',   'mod_booking',  'booking'),
    ('mpm_bk_mice', 'mod_booking',  'booking-mice'),
    ('mpm_bk_grp',  'mod_booking',  'groups'),
    ('mpm_bk_da',   'mod_booking',  'daily-activity'),
    ('mpm_bk_quo',  'mod_booking',  'quotations'),
    ('mpm_bk_pkg',  'mod_booking',  'package'),
    ('mpm_bk_pkgm', 'mod_booking',  'package-mice'),
    ('mpm_bk_comp', 'mod_booking',  'complimentary'),
    ('mpm_bk_promo','mod_booking',  'promo'),
    ('mpm_pur_ven', 'mod_purchase', 'vendor'),
    ('mpm_pur_vs',  'mod_purchase', 'vendor-specialist'),
    ('mpm_pur_proc','mod_purchase', 'procurement')
ON CONFLICT ("moduleId", "permissionModule") DO NOTHING;
