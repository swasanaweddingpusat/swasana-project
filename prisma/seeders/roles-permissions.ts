import { prisma } from "./_client";

// ── Roles ────────────────────────────────────────────────────────────
const roleData = [
  { name: "super-admin", description: "All Access", sortOrder: 1 },
  { name: "direktur-sales", description: "Access to sales data and customer management", sortOrder: 2 },
  { name: "manager", description: "Full access to all features and user management", sortOrder: 3 },
  { name: "direktur-operational", description: "All Access", sortOrder: 4 },
  { name: "operational", description: "All Access", sortOrder: 5 },
  { name: "finance", description: "Access to financial data and reports", sortOrder: 6 },
  { name: "sales", description: "Access to sales data and customer management", sortOrder: 7 },
  { name: "vendor-specialist", description: "Manage Data Vendor Specialist", sortOrder: 8 },
  { name: "human-resource", description: "Access to human resource", sortOrder: 9 },
  { name: "sales-mice", description: "Sales access for MICE bookings", sortOrder: 10 },
];

// ── Modules & Actions ────────────────────────────────────────────────
// Only modules that are ACTUALLY used in code
const moduleActions: Record<string, string[]> = {
  booking: ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
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
  "settings-role-permission": ["view", "create", "edit", "delete"],
  "settings-source-of-information": ["view", "create", "edit", "delete"],
  // CRM modules
  leads: ["view", "create", "edit", "delete"],
  "settings-lead-status": ["view", "create", "edit", "delete"],
  quotations: ["view", "create", "edit", "delete"],
  "booking-mice": ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
};

// Modules removed (not used in code):
// - attendance: fitur belum ada
// - brand_management: redundant, pake settings
// - calendar_event: gak pake permission check
// - catering: actions pake booking.edit
// - dashboard: gak pake requirePagePermission
// - decoration: actions pake booking.edit
// - finance_ap: gak ada page/action yang cek
// - hr: fitur belum ada
// - notification: gak pake permission check
// - user_management: redundant, pake settings
// - venue_management: redundant, pake settings

// ── Role → Permission Matrix ─────────────────────────────────────────
// "super-admin" gets ALL permissions (handled separately).
const rolePermissionMap: Record<string, Record<string, string[]>> = {
  "direktur-sales": {
    booking: ["view", "create", "edit", "approve", "mark-lost", "transfer", "comment", "print", "client-agreement"],
    customers: ["view", "create", "edit"],
    groups: ["view", "view-all", "create", "edit", "delete"],
    package: ["view"],
    vendor: ["view"],
    "finance-ar": ["view"],
    // leads:delete is intentionally reserved for super-admin & manager only.
    leads: ["view", "create", "edit"],
    "settings-lead-status": ["view", "create", "edit", "delete"],
    quotations: ["view", "create", "edit", "delete"],
  },
  // Manager: full access to everything EXCEPT settings-* modules.
  manager: {
    booking: ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
    "booking-mice": ["view", "create", "edit", "delete", "print", "approve", "mark-lost", "restore", "transfer", "reject", "comment", "client-agreement"],
    customers: ["view", "create", "edit", "delete"],
    "finance-ar": ["view", "create", "edit", "delete"],
    groups: ["view", "view-all", "create", "edit", "delete"],
    package: ["view", "create", "edit", "delete", "set-harga", "term-&-condition", "set-status"],
    vendor: ["view", "create", "edit", "delete"],
    "vendor-specialist": ["view", "create", "edit", "delete"],
    leads: ["view", "create", "edit", "delete"],
    quotations: ["view", "create", "edit", "delete"],
  },
  "direktur-operational": {
    booking: ["view", "create", "edit", "approve", "comment", "print"],
    customers: ["view"],
    package: ["view"],
    vendor: ["view", "create", "edit"],
  },
  operational: {
    booking: ["view", "create", "edit", "comment"],
    customers: ["view"],
    package: ["view"],
    vendor: ["view"],
  },
  finance: {
    booking: ["view", "comment"],
    customers: ["view"],
    package: ["view", "create", "edit", "delete", "set-harga", "term-&-condition"],
    "finance-ar": ["view", "create", "edit", "delete"],
    "settings-payment-methods": ["view", "create", "edit", "delete"],
  },
  sales: {
    booking: ["view", "create", "edit", "comment", "client-agreement"],
    customers: ["view", "create", "edit"],
    groups: ["view"],
    package: ["view", "create", "edit", "term-&-condition"],
    vendor: ["view"],
    leads: ["view", "create", "edit"],
    quotations: ["view", "create", "edit"],
  },
  "vendor-specialist": {
    "vendor-specialist": ["view", "create", "edit", "delete"],
    vendor: ["view", "create", "edit", "delete"],
    booking: ["view"],
    package: ["view"],
  },
  "human-resource": {
    "settings-users": ["view"],
    "settings-education-level": ["view"],
  },
  "sales-mice": {
    "booking-mice": ["view", "create", "edit", "comment", "client-agreement"],
    customers: ["view", "create", "edit"],
    package: ["view"],
    vendor: ["view"],
    quotations: ["view", "create", "edit"],
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
  "dashboard", "decoration", "finance", "finance_ap", "finance_ar", "hr", "notification",
  "user_management", "venue_management", "client_agreement", "settlement",
  "settings", "payment_methods", "role_permission", "source_of_information",
  "settings-groups", // renamed → "groups" (code uses module "groups", not "settings-groups")
  "settings-approval-flow", // approval flow is now hardcoded, no longer a DB-driven setting
  "approval", // approve/reject authorization handled by role-matching in approval flow (manager → finance), not a permission toggle
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
  const staleActions = [
    { module: "booking", action: "approve_manager" },
    { module: "booking", action: "approve_finance" },
    { module: "booking", action: "approve_operations" },
    { module: "booking", action: "approve_oprations" },
    { module: "booking", action: "mark_lost" },
    { module: "package", action: "set_harga" },
    { module: "package", action: "term-and-condition" },
    { module: "package", action: "set-status" },
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

  console.error(`✅ ${roleData.length} Roles, ${permissionData.length} Permissions seeded`);
}

// Run standalone
if (process.argv[1].includes("roles-permissions")) {
  seedRolesPermissions()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
