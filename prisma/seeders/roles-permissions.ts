import { prisma } from "./_client";

// ── Roles ────────────────────────────────────────────────────────────
const roleData = [
  { name: "Super Admin", description: "All Access", sortOrder: 1 },
  { name: "direktur sales", description: "Access to sales data and customer management", sortOrder: 2 },
  { name: "manager", description: "Full access to all features and user management", sortOrder: 3 },
  { name: "direktur operational", description: "All Access", sortOrder: 4 },
  { name: "operational", description: "All Access", sortOrder: 5 },
  { name: "finance", description: "Access to financial data and reports", sortOrder: 6 },
  { name: "sales", description: "Access to sales data and customer management", sortOrder: 7 },
  { name: "vendor specialist", description: "Manage Data Vendor Specialist", sortOrder: 8 },
  { name: "human resource", description: "Access to human resource", sortOrder: 9 },
];

// ── Modules & Actions ────────────────────────────────────────────────
// Only modules that are ACTUALLY used in code
const moduleActions: Record<string, string[]> = {
  booking: ["view", "create", "edit", "delete", "print", "approve", "approve_manager", "approve_finance", "approve_operations", "mark_lost", "restore", "transfer", "reject", "comment"],
  client_agreement: ["view", "create", "edit"],
  customers: ["view", "create", "edit", "delete"],
  finance: ["view", "create", "edit", "delete"],
  finance_ar: ["view", "create", "edit", "delete"],
  package: ["view", "create", "edit", "delete", "set_harga"],
  payment_methods: ["view", "create", "edit", "delete"],
  role_permission: ["view", "create", "edit", "delete"],
  settings: ["view", "create", "edit", "delete"],
  settlement: ["view", "create", "edit", "delete"],
  source_of_information: ["view", "create", "edit", "delete"],
  vendor: ["view", "create", "edit", "delete"],
  approval: ["view", "create", "edit"],
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
// "Super Admin" gets ALL permissions (handled separately).
const rolePermissionMap: Record<string, Record<string, string[]>> = {
  "direktur sales": {
    booking: ["view", "create", "edit", "approve", "approve_manager", "comment", "print"],
    customers: ["view", "create", "edit"],
    package: ["view"],
    vendor: ["view"],
    settings: ["view"],
    finance: ["view"],
    finance_ar: ["view"],
    settlement: ["view"],
    client_agreement: ["view", "create", "edit"],
    approval: ["view"],
  },
  manager: {
    booking: ["view", "create", "edit", "delete", "print", "approve", "approve_manager", "approve_finance", "approve_operations", "mark_lost", "restore", "transfer", "reject", "comment"],
    customers: ["view", "create", "edit", "delete"],
    package: ["view", "create", "edit", "delete"],
    vendor: ["view", "create", "edit", "delete"],
    settings: ["view", "create", "edit", "delete"],
    payment_methods: ["view", "create", "edit", "delete"],
    settlement: ["view", "create", "edit", "delete"],
    client_agreement: ["view", "create", "edit"],
    role_permission: ["view", "edit"],
    finance: ["view"],
    finance_ar: ["view"],
    approval: ["view", "create", "edit"],
    source_of_information: ["view", "create", "edit", "delete"],
  },
  "direktur operational": {
    booking: ["view", "create", "edit", "approve", "approve_operations", "comment", "print"],
    customers: ["view"],
    package: ["view"],
    vendor: ["view", "create", "edit"],
    settings: ["view"],
    settlement: ["view"],
    approval: ["view"],
  },
  operational: {
    booking: ["view", "create", "edit", "comment"],
    customers: ["view"],
    package: ["view"],
    vendor: ["view"],
    settings: ["view"],
  },
  finance: {
    booking: ["view", "approve_finance", "comment"],
    customers: ["view"],
    package: ["view", "create", "edit", "delete", "set_harga"],
    finance: ["view", "create", "edit", "delete"],
    finance_ar: ["view", "create", "edit", "delete"],
    payment_methods: ["view", "create", "edit", "delete"],
    settlement: ["view", "create", "edit", "delete"],
    client_agreement: ["view"],
  },
  sales: {
    booking: ["view", "create", "edit", "comment"],
    customers: ["view", "create", "edit"],
    package: ["view", "create", "edit"],
    vendor: ["view"],
    client_agreement: ["view", "create", "edit"],
    settlement: ["view"],
  },
  "vendor specialist": {
    vendor: ["view", "create", "edit", "delete"],
    booking: ["view"],
    package: ["view"],
    settings: ["view"],
  },
  "human resource": {
    settings: ["view"],
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
  "dashboard", "decoration", "finance_ap", "hr", "notification",
  "user_management", "venue_management",
];

// ── Main Seeder ──────────────────────────────────────────────────────
export async function seedRolesPermissions(): Promise<void> {
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

  // 5. Assign ALL permissions to Super Admin
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
    });
    if (!existing) await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });
  }

  // 6. Assign permissions per role from the matrix
  for (const [roleName, modules] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const [mod, actions] of Object.entries(modules)) {
      for (const action of actions) {
        const perm = await prisma.permission.findUnique({
          where: { module_action: { module: mod, action } },
        });
        if (!perm) continue;
        const existing = await prisma.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        });
        if (!existing) await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
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
