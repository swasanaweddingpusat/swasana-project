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
  { name: "stakeholder", description: "Monitoring-only access for executives", sortOrder: 15 },
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
  // Read-only monitoring hub (Settings > Booking Log) — gabungan activity log
  // booking Wedding + MICE. View-only: tidak ada mutasi dari halaman ini.
  "settings-booking-log": ["view"],
  complimentary: ["view", "create", "edit", "delete"],
  // CRM modules
  "daily-activity": ["view", "create", "edit", "delete"],
  "settings-lead-status": ["view", "create", "edit", "delete"],
  "settings-daily-activity-segment": ["view", "create", "edit", "delete"],
  quotations: ["view", "create", "edit", "delete"],
  "booking-mice": ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
  // "term-&-condition" — FE label ditampilkan sebagai "Term & Payment" (bukan "Term & Condition") khusus MICE.
  "package-mice": ["view", "create", "edit", "delete", "set-harga", "set-status", "term-&-condition"],
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
  // Attendance — own permission so ALL roles can be granted `attendance:view`
  // (menu Absensi = GENERAL) without unlocking the whole HRD world (hr:view).
  attendance: ["view"],
  // HR Recruitment & Onboarding — seeded originally via migration 20260622180000.
  // Listed here so the seeder treats it as a valid module (else step 3b would
  // delete these permissions) and can assign them per the role matrix.
  "hr-recruitment": ["view", "create", "edit", "delete", "hire", "approve"],
  // Finance AP — customer payout (cashback program + overpay refund)
  "finance-ap": ["view", "create", "edit", "delete"],
  // Internal FAQ / Memo — general knowledge-base module
  "internal-faq": ["view", "create", "edit", "delete"],
  // Announcement — company-wide announcements module
  "announcement": ["view", "create", "edit", "delete"],
  // Performance Sales — read-only monitoring hub for the STAKEHOLDER world.
  // View-only: no mutation surface (dashboard reads getGroupsWithPerformance).
  "performance-sales": ["view"],
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
    "internal-faq": ["view"],
    announcement: ["view"],
    "settings-booking-log": ["view"],
  },
  // Manager: CRUD only on dashboard, calendar-event, groups, booking-weddings,
  // package, complimentary, vendors, and customers.
  // (dashboard has no permission module; calendar-event is gated by booking:view.)
  manager: {
    // restore/mark-lost/reject/delete sengaja DICABUT — manager gak boleh lakuin ini di booking.
    booking: ["view", "create", "edit", "print", "approve", "cancel", "transfer", "comment", "client-agreement", "edit-package", "edit-set-harga"],
    customers: ["view", "create", "edit", "delete"],
    groups: ["view", "create", "edit", "delete"],
    // daily-activity sengaja DICABUT — cuma manager-mice yang butuh.
    package: ["view", "create", "edit", "delete", "set-harga", "term-&-condition", "set-status"],
    vendor: ["view", "create", "edit", "delete"],
    complimentary: ["view", "create", "edit", "delete"],
    guestbook: ["view", "create", "edit"],
    promo: ["view"],
    procurement: ["view", "create", "edit", "delete", "approve"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
    // hr/hr-recruitment sengaja DICABUT — manager gak perlu akses module HRD sama sekali.
    bitrix: ["view"],
    "internal-faq": ["view", "create", "edit", "delete"],
    announcement: ["view", "create", "edit", "delete"],
    "settings-booking-log": ["view"],
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
    "internal-faq": ["view", "create", "edit", "delete"],
    announcement: ["view", "create", "edit", "delete"],
    "settings-booking-log": ["view"],
  },
  // Operational — persis daftar menu yang disepakati (11 item) + Internal FAQ
  // & Announcement (dipertahankan sesuai kebutuhan, walau tidak tercantum di spec):
  //   Pengadaan/Ringkasan/Pengumuman/Anggaran Venue → 4 tab Procurement (CRUD).
  //   Vendor (view) · Purchase Order → vendor-specialist:view.
  //   Absensi → attendance:view (force-granted semua role, step 9).
  //   Guestbook · Slip Gaji (Personal) + Pengajuan Cuti (General, tanpa gate).
  // Akses lama booking/customers/package/maintenance/promo sengaja DICABUT.
  operational: {
    procurement: ["view", "create", "edit", "delete"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
    vendor: ["view"],
    "vendor-specialist": ["view"],
    guestbook: ["view", "create", "edit"],
    "internal-faq": ["view"],
    announcement: ["view"],
    bitrix: ["view"],
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
    // Absensi via attendance:view (force-granted semua role, step 9).
    "finance-ar": ["view", "create", "edit", "delete"],
    "finance-ap": ["view", "create", "edit", "delete"],
    // Only tab Pengadaan — Ringkasan/Pengumuman/Anggaran Venue reserved for management roles.
    procurement: ["view"],
    // Booking (wedding): banyak action buat keperluan finance, KECUALI mark-lost/reject/delete/restore/reset-approval.
    // restore cuma super-admin. reset-approval sengaja dilarang buat sales/manager/finance.
    booking: ["view", "create", "edit", "print", "approve", "cancel", "transfer", "transfer-manager", "comment", "client-agreement", "edit-set-harga"],
    "booking-mice": ["view"],
    complimentary: ["view", "create"],
    bitrix: ["view"],
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
  // Sales (Wedding) — persis daftar menu yang disepakati (11 item), MINUS Daily
  // Activity (sengaja ditahan dulu per instruksi user):
  //   Groups · Booking Weddings · Wedding Package ·
  //   Voucher/Program · Complimentary · Guestbook · Procurement (Only Pengadaan).
  //   Absensi → attendance:view (force-granted semua role, step 9).
  //   Slip Gaji (Personal) + Pengajuan Cuti → General nav, tanpa gate.
  // settings-source-of-information/vendor/internal-faq/announcement
  // sengaja DICABUT — tidak ada di spec menu Sales Wedding.
  // bitrix: view + customers: full CRUD diminta belakangan.
  sales: {
    booking: ["view", "create", "edit", "comment", "client-agreement", "print"],
    groups: ["view"],
    // daily-activity sengaja BELUM di-grant — per instruksi user, ditahan dulu.
    package: ["view", "create", "edit", "term-&-condition"],
    guestbook: ["view", "create", "edit"],
    // Full CRUD — sales kelola master complimentary sendiri.
    complimentary: ["view", "create", "edit", "delete"],
    promo: ["view", "create", "edit", "delete"],
    // Only tab Pengadaan — Ringkasan/Pengumuman/Anggaran Venue reserved for management roles.
    procurement: ["view"],
    bitrix: ["view"],
    // Full CRUD — sales kelola customer sendiri.
    customers: ["view", "create", "edit", "delete"],
  },
  "vendor-specialist": {
    "vendor-specialist": ["view", "create", "edit", "delete"],
    vendor: ["view", "create", "edit", "delete"],
    booking: ["view"],
    package: ["view"],
  },
  // human-resource — persis daftar menu yang disepakati (14 item):
  //   Database Karyawan · Manajemen Kehadiran · Penggajian & Perpajakan ·
  //   Slip Gaji (Summary All) · Sistem Cuti · Pengembangan SDM ·
  //   Manajemen Kinerja · Manajemen Kesehatan · Reimbursement & Loan ·
  //   Hubungan Industrial · Analitik & Laporan → semua via `hr:view`.
  //   Rekrutmen & Onboarding → `hr-recruitment:view`.
  //   Procurement (Only tab Pengadaan) → `procurement:view` saja.
  //   Absensi → `attendance:view` (force-granted semua role, step 9).
  // Guestbook/Internal FAQ/Announcement/Settings (Users, Education Level)
  // sengaja DICABUT — tidak ada di spec menu HR.
  "human-resource": {
    hr: ["view", "create", "edit", "delete", "approve"],
    "hr-recruitment": ["view", "create", "edit", "delete", "hire", "approve"],
    procurement: ["view"],
  },
  // Sales MICE — persis daftar menu yang disepakati (11 item):
  //   Groups · Daily Activity · Bookings MICE · Quotations · Mice Package ·
  //   Complimentary · Guestbook · Procurement (Only Pengadaan).
  //   Absensi → attendance:view (force-granted semua role, step 9).
  //   Slip Gaji (Personal) + Pengajuan Cuti → General nav, tanpa gate.
  // vendor/settings-daily-activity-segment/internal-faq/announcement
  // sengaja DICABUT — tidak ada di spec menu Sales MICE.
  // bitrix: view + customers: view/create diminta belakangan.
  "sales-mice": {
    "booking-mice": ["view", "create", "edit", "comment", "client-agreement"],
    groups: ["view"],
    quotations: ["view", "create", "edit"],
    "daily-activity": ["view", "create", "edit", "delete"],
    // Full CRUD — sales-mice kelola master complimentary sendiri.
    complimentary: ["view", "create", "edit", "delete"],
    guestbook: ["view", "create", "edit"],
    // sales-mice can view/create/edit packages but NOT set-harga and NOT delete
    "package-mice": ["view", "create", "edit", "term-&-condition"],
    // Only tab Pengadaan — Ringkasan/Pengumuman/Anggaran Venue reserved for management roles.
    procurement: ["view"],
    bitrix: ["view"],
    // sales-mice bisa nambah customer baru.
    customers: ["view", "create"],
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
    "package-mice": ["view", "create", "edit", "delete", "set-harga", "set-status", "term-&-condition"],
    complimentary: ["view", "create", "edit", "delete"],
    bitrix: ["view"],
    "internal-faq": ["view"],
    announcement: ["view"],
    "settings-booking-log": ["view"],
  },
  "procurement-manager": {
    procurement: ["view", "create", "edit", "delete", "approve"],
    "procurement-summary": ["view"],
    "procurement-announcement": ["view", "create", "edit", "delete"],
    "procurement-budget": ["view", "create", "edit", "delete"],
  },
  // Stakeholder — petinggi, monitoring-only. Satu-satunya akses: Performance Sales
  // (world "Stakeholder"). Read-only, tidak ada permission mutasi apa pun.
  stakeholder: {
    "performance-sales": ["view"],
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
  "brand_management", "calendar_event", "catering",
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

  // 9. Force-grant attendance:view to ALL roles.
  // Absensi is a GENERAL menu (all roles can clock in/out); `attendance` is a
  // dedicated permission so granting it does NOT unlock the HRD world (hr:view).
  // Runs AFTER step 6 wipe-and-replace so it sticks for roles whose matrix omits it.
  const attendancePerm = await prisma.permission.findUnique({
    where: { module_action: { module: "attendance", action: "view" } },
  });
  if (attendancePerm) {
    const everyRole = await prisma.role.findMany({ select: { id: true } });
    for (const role of everyRole) {
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: attendancePerm.id } },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: attendancePerm.id } });
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
