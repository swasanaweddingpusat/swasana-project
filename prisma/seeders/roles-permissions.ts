import { prisma } from "./_client";

// ── Roles ────────────────────────────────────────────────────────────
export const roleData = [
  { name: "super-admin", description: "All Access", sortOrder: 1 },
  { name: "direktur-sales", description: "Access to sales data and customer management", sortOrder: 2 },
  { name: "manager", description: "Full access to all features and user management", sortOrder: 3 },
  { name: "direktur-operational", description: "All Access", sortOrder: 4 },
  { name: "operational", description: "All Access", sortOrder: 5 },
  { name: "finance", description: "Full finance access (AR + AP + cashflow + overview)", sortOrder: 6 },
  { name: "finance-ar", description: "Accounts Receivable + cashflow only", sortOrder: 13 },
  { name: "finance-ap", description: "Accounts Payable + expense + cashflow only", sortOrder: 14 },
  { name: "sales", description: "Access to sales data and customer management", sortOrder: 7 },
  { name: "vendor-specialist", description: "Manage Data Vendor Specialist", sortOrder: 8 },
  { name: "human-resource", description: "Access to human resource", sortOrder: 9 },
  { name: "sales-mice", description: "Sales access for MICE bookings", sortOrder: 10 },
  { name: "manager-mice", description: "Manager access for MICE features (leads, quotations, booking-mice)", sortOrder: 11 },
  { name: "procurement-manager", description: "Manage procurement requests and approvals", sortOrder: 12 },
];

// ── Modules & Actions ────────────────────────────────────────────────
// Only modules that are ACTUALLY used in code
export const moduleActions: Record<string, string[]> = {
  booking: ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "cancel", "transfer", "transfer-manager", "reject", "comment", "client-agreement", "term-&-condition", "edit-package", "edit-set-harga", "reset-approval"],
  customers: ["view", "create", "edit", "delete"],
  "finance-ar": ["view", "create", "edit", "delete"],
  groups: ["view", "view-all", "create", "edit", "delete"],
  package: ["view", "create", "edit", "delete", "set-harga", "term-&-condition", "set-status"],
  vendor: ["view", "create", "edit", "delete"],
  "vendor-specialist": ["view", "create", "edit", "delete"],
  // Settings sub-modules
  "settings-brands": ["view", "create", "edit", "delete"],
  "settings-venues": ["view", "create", "edit", "delete"],
  "settings-users": ["view", "create", "edit", "delete"],
  "settings-education-level": ["view", "create", "edit", "delete"],
  "settings-event-types": ["view", "create", "edit", "delete"],
  "settings-order-status": ["view", "create", "edit", "delete"],
  "settings-payment-methods": ["view", "create", "edit", "delete"],
  "settings-quotation-templates": ["view", "create", "edit", "delete"],
  "settings-role-permission": ["view", "create", "edit", "delete"],
  "settings-source-of-information": ["view", "create", "edit", "delete"],
  "settings-tutorial": ["view", "create", "edit", "delete"],
  complimentary: ["view", "create", "edit", "delete"],
  // CRM modules
  "daily-activity": ["view", "create", "edit", "delete"],
  "settings-lead-status": ["view", "create", "edit", "delete"],
  "settings-daily-activity-segment": ["view", "create", "edit", "delete"],
  quotations: ["view", "create", "edit", "delete"],
  "booking-mice": ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
  // NOTE: "term-&-condition" is intentionally absent — T&C is hidden for MICE via missing permission.
  "package-mice": ["view", "create", "edit", "delete", "set-harga", "set-status"],
  // Maintenance modules
  maintenance: ["view", "create", "edit", "delete"],
  "settings-maintenance-category": ["view", "create", "edit", "delete"],
  "settings-maintenance-priority": ["view", "create", "edit", "delete"],
  "settings-maintenance-status": ["view", "create", "edit", "delete"],
  promo: ["view", "create", "edit", "delete"],
  procurement: ["view", "create", "edit", "delete", "approve"],
  // Procurement sub-tabs split off `procurement` so a role can be granted the
  // main "Pengadaan" list WITHOUT the other three tabs (e.g. HRD gets Pengadaan
  // only). Each gates one sidebar submenu + its API routes:
  //   procurement-summary      → Ringkasan      (/procurement/ringkasan)
  //   procurement-announcement → Pengumuman     (/procurement/pengumuman)
  //   procurement-budget       → Anggaran Venue (/procurement/anggaran-venue)
  "procurement-summary": ["view"],
  "procurement-announcement": ["view", "create", "edit", "delete"],
  "procurement-budget": ["view", "create", "edit", "delete"],
  guestbook: ["view", "create", "edit"],
  // Bitrix24 CRM integration — own gate (was reusing `customers`). GENERAL menu
  // (muncul di semua module), route /bitrix24/*.
  bitrix: ["view"],
  // HR & Payroll module
  hr: ["view", "create", "edit", "delete", "approve"],
  // HR Recruitment & Onboarding — seeded originally via migration 20260622180000.
  // Listed here so the seeder treats it as a valid module (else step 3b would
  // delete these permissions) and can assign them per the role matrix.
  "hr-recruitment": ["view", "create", "edit", "delete", "hire"],
  // Finance AP — customer payout (cashback program + overpay refund)
  "finance-ap": ["view", "create", "edit", "delete"],
};

// Modules removed (not used in code):
// - attendance: fitur belum ada
// - brand_management: redundant, pake settings
// - calendar_event: gak pake permission check
// - catering: actions pake booking.edit
// - dashboard: gak pake requirePagePermission
// - decoration: actions pake booking.edit
// - finance_ap (underscore): lama / removed; pakai "finance-ap" (dash) sekarang
// - notification: gak pake permission check
// - user_management: redundant, pake settings
// - venue_management: redundant, pake settings

// ── Role → Permission Matrix ─────────────────────────────────────────
// "super-admin" gets ALL permissions (handled separately).
export const rolePermissionMap: Record<string, Record<string, string[]>> = {
  "direktur-sales": {
    booking: ["view", "create", "edit", "approve", "mark-lost", "transfer", "transfer-manager", "comment", "print", "client-agreement"],
    customers: ["view", "create", "edit"],
    groups: ["view", "view-all", "create", "edit", "delete"],
    package: ["view"],
    vendor: ["view"],
    "finance-ar": ["view"],
    // daily-activity:delete is intentionally reserved for super-admin & manager only.
    "daily-activity": ["view", "create", "edit"],
    "settings-lead-status": ["view", "create", "edit", "delete"],
    "settings-daily-activity-segment": ["view", "create", "edit", "delete"],
    quotations: ["view", "create", "edit", "delete"],
    "settings-quotation-templates": ["view", "create", "edit", "delete"],
    complimentary: ["view", "create", "edit", "delete"],
    guestbook: ["view", "create", "edit"],
    promo: ["view"],
    bitrix: ["view"],
  },
  // Manager: CRUD only on dashboard, calendar-event, groups, booking-weddings,
  // package, complimentary, vendors, and customers.
  // (dashboard has no permission module; calendar-event is gated by booking:view.)
  manager: {
    booking: ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "cancel", "transfer", "reject", "comment", "client-agreement", "edit-package", "edit-set-harga"],
    customers: ["view", "create", "edit", "delete"],
    groups: ["view", "create", "edit", "delete"],
    "daily-activity": ["view", "create", "edit", "delete"],
    package: ["view", "create", "edit", "delete", "set-harga", "term-&-condition", "set-status"],
    vendor: ["view", "create", "edit", "delete"],
    complimentary: ["view", "create", "edit", "delete"],
    guestbook: ["view", "create", "edit"],
    promo: ["view"],
    procurement: ["view", "create", "edit", "delete", "approve"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
    hr: ["view", "create", "edit", "delete", "approve"],
    bitrix: ["view"],
  },
  "direktur-operational": {
    booking: ["view", "create", "edit", "approve", "comment", "print"],
    customers: ["view"],
    package: ["view"],
    vendor: ["view", "create", "edit"],
    maintenance: ["view", "create", "edit"],
    guestbook: ["view", "create", "edit"],
    promo: ["view"],
    procurement: ["view", "approve"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
    bitrix: ["view"],
  },
  // Operational — persis daftar menu yang disepakati:
  //   Procurement (4 tab, CRUD) · Vendor (view) · Purchase Order (view) ·
  //   Guestbook · Slip Gaji Personal + Pengajuan Cuti (General, tanpa gate).
  // Akses lama booking/customers/package/maintenance/promo sengaja DICABUT.
  // Absensi (lintas-role) butuh perubahan nav/permission — di luar scope seeder.
  operational: {
    procurement: ["view", "create", "edit", "delete"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
    vendor: ["view"],
    "vendor-specialist": ["view"],
    guestbook: ["view", "create", "edit"],
  },
  finance: {
    // Lean scope per spec — sidebar Finance hanya: Overview, Report & Analytics,
    // Income, Expense, AR, AP. Cuti & Slip Gaji tampil via GENERAL_NAV (tanpa
    // permission). Settings TIDAK ditampilkan karena tidak ada permission
    // settings-* di sini (menu Settings hanya muncul kalau role punya salah satu
    // SETTINGS_MODULES:view).
    // NOTE: getPaymentMethodsForPicker() (dipakai ack cash-in di Income) adalah
    // cached read TANPA gate, jadi ack tetap jalan tanpa settings-payment-methods.
    // booking::term-&-condition auto-granted via step 7; booking::edit-package via step 8.
    // TODO(blocker code): Absensi (item 6) butuh route General /absensi + gate
    // clock-in/out dilonggarkan; Procurement "Only tab Pengadaan" (item 8) butuh
    // split permission per-tab. Belum di-grant di sini sampai kode-nya siap.
    "finance-ar": ["view", "create", "edit", "delete"],
    "finance-ap": ["view", "create", "edit", "delete"],
  },
  // Finance AR only — Accounts Receivable + Cashflow (+ Overview). Can record/ack
  // cash-in and edit termin (updateTermOfPayments accepts finance-ar:edit). No AP access.
  "finance-ar": {
    "finance-ar": ["view", "create", "edit", "delete"],
    // read-only booking context so AR rows show customer/event/package labels
    booking: ["view"],
    customers: ["view"],
    bitrix: ["view"],
  },
  // Finance AP only — Expense + Accounts Payable + Customer Payout + Cashflow (+ Overview).
  // No AR access (can't ack cash-in or edit termin).
  "finance-ap": {
    "finance-ap": ["view", "create", "edit", "delete"],
    booking: ["view"],
    customers: ["view"],
    bitrix: ["view"],
  },
  sales: {
    booking: ["view", "create", "edit", "comment", "client-agreement", "print"],
    customers: ["view", "create", "edit"],
    groups: ["view"],
    package: ["view", "create", "edit", "term-&-condition"],
    vendor: ["view"],
    "settings-source-of-information": ["view", "create", "edit", "delete"],
    guestbook: ["view", "create", "edit"],
    // daily-activity intentionally removed — sales (wedding) no longer sees it.
    // quotations intentionally removed — sales role no longer has quotation access.
    // view+create only: sales can select & create complimentary on-the-fly from booking drawer,
    // but master data management (edit/delete) is reserved for direktur-sales and above.
    complimentary: ["view", "create"],
    promo: ["view", "create", "edit", "delete"],
    bitrix: ["view"],
  },
  "vendor-specialist": {
    "vendor-specialist": ["view", "create", "edit", "delete"],
    vendor: ["view", "create", "edit", "delete"],
    booking: ["view"],
    package: ["view"],
  },
  "human-resource": {
    hr: ["view", "create", "edit", "delete", "approve"],
    // Rekrutmen & Onboarding — full lifecycle incl. hiring (creates employee account).
    "hr-recruitment": ["view", "create", "edit", "delete", "hire"],
    // Procurement — ONLY the "Pengadaan" tab. Now that the sidebar submenu is
    // split per-tab (procurement / -summary / -announcement / -budget), granting
    // `procurement:view` alone shows Pengadaan without Ringkasan/Pengumuman/
    // Anggaran Venue. view-only: HRD sees the list but doesn't manage requests.
    procurement: ["view"],
    "settings-users": ["view", "create", "edit", "delete"],
    "settings-education-level": ["view", "create", "edit", "delete"],
    guestbook: ["view", "create", "edit"],
  },
  "sales-mice": {
    "booking-mice": ["view", "create", "edit", "comment", "client-agreement"],
    customers: ["view", "create", "edit"],
    vendor: ["view"],
    quotations: ["view", "create", "edit"],
    "daily-activity": ["view", "create", "edit", "delete"],
    complimentary: ["view", "create"],
    "settings-daily-activity-segment": ["view"],
    guestbook: ["view", "create", "edit"],
    // sales-mice can view/create/edit packages but NOT set-harga and NOT delete
    "package-mice": ["view", "create", "edit"],
    bitrix: ["view"],
  },
  "manager-mice": {
    "booking-mice": ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
    "daily-activity": ["view", "create", "edit", "delete"],
    quotations: ["view", "create", "edit", "delete"],
    groups: ["view", "create", "edit", "delete"],
    customers: ["view", "create", "edit", "delete"],
    "settings-event-types": ["view", "create", "edit", "delete"],
    "settings-quotation-templates": ["view", "create", "edit", "delete"],
    "settings-daily-activity-segment": ["view", "create", "edit", "delete"],
    "package-mice": ["view", "create", "edit", "delete", "set-harga", "set-status"],
    bitrix: ["view"],
  },
  "procurement-manager": {
    procurement: ["view", "create", "edit", "delete", "approve"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────
function buildPermissionData(): { module: string; action: string }[] {
  return Object.entries(moduleActions).flatMap(([mod, actions]) =>
    actions.map((action) => ({ module: mod, action }))
  );
}

// Modules that were removed — clean up stale permissions from DB
const REMOVED_MODULES = [
  "attendance", "brand_management", "calendar_event", "catering",
  "dashboard", "decoration", "finance", "finance_ap", "finance_ar", "notification",
  "user_management", "venue_management", "client_agreement", "settlement",
  "settings", "payment_methods", "role_permission", "source_of_information",
  "settings-groups", // renamed → "groups" (code uses module "groups", not "settings-groups")
  "settings-approval-flow", // approval flow is now hardcoded, no longer a DB-driven setting
  "approval", // approve/reject authorization handled by role-matching in approval flow (manager → finance), not a permission toggle
  "settings-complimentary", // renamed → "complimentary" (now a top-level module, not under settings)
  "leads", // renamed → "daily-activity" (feature renamed; grants migrated via 20260807120000 migration)
  "settings-lead-segment", // renamed → "settings-daily-activity-segment" (grants migrated via 20260809160000 migration)
];

// ── Main Seeder ──────────────────────────────────────────────────────
export async function seedRolesPermissions(): Promise<void> {
  // 0. Migrate old role names to new kebab-case format
  const ROLE_RENAME_MAP: Record<string, string> = {
    "Super Admin": "super-admin",
    "direktur sales": "direktur-sales",
    "direktur operational": "direktur-operational",
    "vendor specialist": "vendor-specialist",
    "human resource": "human-resource",
  };
  for (const [oldName, newName] of Object.entries(ROLE_RENAME_MAP)) {
    const existing = await prisma.role.findUnique({ where: { name: oldName } });
    if (existing) {
      const newExists = await prisma.role.findUnique({ where: { name: newName } });
      if (!newExists) {
        await prisma.role.update({ where: { id: existing.id }, data: { name: newName } });
      }
    }
  }

  // 1. Seed roles
  for (const data of roleData) {
    const existing = await prisma.role.findUnique({ where: { name: data.name } });
    if (!existing) await prisma.role.create({ data });
  }

  // 1b. Ensure super-admin always has isSystemRole = true (migration guard)
  await prisma.role.update({
    where: { name: "super-admin" },
    data: { isSystemRole: true },
  });

  // 2. Seed permissions
  const permissionData = buildPermissionData();
  for (const data of permissionData) {
    const existing = await prisma.permission.findUnique({
      where: { module_action: { module: data.module, action: data.action } },
    });
    if (!existing) await prisma.permission.create({ data });
  }

  // 3. Clean up stale permissions from removed modules
  for (const mod of REMOVED_MODULES) {
    const stalePerms = await prisma.permission.findMany({ where: { module: mod } });
    for (const perm of stalePerms) {
      await prisma.rolePermission.deleteMany({ where: { permissionId: perm.id } });
      await prisma.permission.delete({ where: { id: perm.id } });
    }
  }

  // 3b. Clean up old casing variants (e.g. "Booking" → "booking", "Finance_ar" → "finance-ar")
  // First migrate role assignments from old → new permission, then delete old
  const validModules = new Set(Object.keys(moduleActions));
  const allPerms = await prisma.permission.findMany({ select: { id: true, module: true, action: true } });
  for (const perm of allPerms) {
    if (!validModules.has(perm.module)) {
      // Try to find the canonical version (lowercase + kebab)
      const canonical = perm.module.toLowerCase().replace(/_/g, "-");
      if (validModules.has(canonical)) {
        // Find the new permission with same canonical module + same action
        const newPerm = await prisma.permission.findUnique({
          where: { module_action: { module: canonical, action: perm.action } },
        });
        if (newPerm) {
          // Migrate role assignments: re-assign to new permission
          const oldAssignments = await prisma.rolePermission.findMany({ where: { permissionId: perm.id } });
          for (const rp of oldAssignments) {
            const exists = await prisma.rolePermission.findUnique({
              where: { roleId_permissionId: { roleId: rp.roleId, permissionId: newPerm.id } },
            });
            if (!exists) {
              await prisma.rolePermission.create({ data: { roleId: rp.roleId, permissionId: newPerm.id } });
            }
          }
        }
      }
      // Delete old role assignments + old permission
      await prisma.rolePermission.deleteMany({ where: { permissionId: perm.id } });
      await prisma.permission.delete({ where: { id: perm.id } });
    }
  }

  // 4. Fix legacy typo if present
  const typo = await prisma.permission.findUnique({
    where: { module_action: { module: "booking", action: "approve_oprations" } },
  });
  if (typo) {
    const correctExists = await prisma.permission.findUnique({
      where: { module_action: { module: "booking", action: "approve_operations" } },
    });
    if (correctExists) {
      await prisma.permission.delete({ where: { id: typo.id } });
    } else {
      await prisma.permission.update({ where: { id: typo.id }, data: { action: "approve_operations" } });
    }
  }

  // 4b. Clean up stale actions (old format)
  // NOTE: "package::set-status" is a LIVE permission in moduleActions — do NOT list it here.
  // Only list truly-removed actions (old snake_case or renamed actions no longer in moduleActions).
  const staleActions = [
    { module: "booking", action: "approve_manager" },
    { module: "booking", action: "approve_finance" },
    { module: "booking", action: "approve_operations" },
    { module: "booking", action: "approve_oprations" },
    { module: "booking", action: "mark_lost" },
    { module: "package", action: "set_harga" },
    { module: "package", action: "term-and-condition" },
    // "package::set-status" removed from this list — it is a valid current permission in moduleActions.
    // Previously listed here by mistake (only "set_status" underscore variant was stale, not "set-status").
  ];
  for (const { module, action } of staleActions) {
    const stale = await prisma.permission.findUnique({ where: { module_action: { module, action } } });
    if (stale) {
      await prisma.rolePermission.deleteMany({ where: { permissionId: stale.id } });
      await prisma.permission.delete({ where: { id: stale.id } });
    }
  }

  // 5. Assign ALL permissions to Super Admin
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "super-admin" } });
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
    });
    if (!existing) await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });
  }

  // 6. Assign permissions per role from the matrix (wipe-and-replace per role for idempotency)
  for (const [roleName, modules] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    // Wipe existing assignments for this role so removals take effect
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const [mod, actions] of Object.entries(modules)) {
      for (const action of actions) {
        const perm = await prisma.permission.findUnique({
          where: { module_action: { module: mod, action } },
        });
        if (!perm) continue;
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
      }
    }
  }

  // 7. Force-grant booking:term-&-condition to ALL roles.
  // This permission is intentionally universal — every role can edit a booking's
  // Term & Condition. It runs AFTER the per-role matrix wipe-and-replace (step 6)
  // so the grant is not removed for roles whose matrix omits it.
  const bookingTcPerm = await prisma.permission.findUnique({
    where: { module_action: { module: "booking", action: "term-&-condition" } },
  });
  if (bookingTcPerm) {
    const everyRole = await prisma.role.findMany({ select: { id: true } });
    for (const role of everyRole) {
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: bookingTcPerm.id } },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: bookingTcPerm.id } });
      }
    }
  }

  // 8. Force-grant booking:edit-package to ALL roles.
  // Every role that can view bookings can also edit the package snapshot items.
  // Runs AFTER step 6 wipe-and-replace so it sticks for roles whose matrix omits it.
  const bookingEditPackagePerm = await prisma.permission.findUnique({
    where: { module_action: { module: "booking", action: "edit-package" } },
  });
  if (bookingEditPackagePerm) {
    const everyRole = await prisma.role.findMany({ select: { id: true } });
    for (const role of everyRole) {
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: bookingEditPackagePerm.id } },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: bookingEditPackagePerm.id } });
      }
    }
  }

  console.error(`✅ ${roleData.length} Roles, ${permissionData.length} Permissions seeded`);
}

// Run standalone
if (process.argv[1].includes("roles-permissions")) {
  seedRolesPermissions()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
