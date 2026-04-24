import { prisma } from "./_client";

export async function seedRolesPermissions() {
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

  for (const data of roleData) {
    const existing = await prisma.role.findUnique({ where: { name: data.name } });
    if (!existing) await prisma.role.create({ data });
  }

  const permissionData: { module: string; action: string; description?: string }[] = [
    { module: "attendance", action: "view" }, { module: "attendance", action: "create" },
    { module: "attendance", action: "edit" }, { module: "attendance", action: "delete" },
    { module: "booking", action: "view" }, { module: "booking", action: "create" },
    { module: "booking", action: "edit" }, { module: "booking", action: "delete" },
    { module: "booking", action: "print" }, { module: "booking", action: "approve" },
    { module: "booking", action: "approve_manager" }, { module: "booking", action: "approve_finance" },
    { module: "booking", action: "approve_oprations" }, { module: "booking", action: "mark_lost" },
    { module: "booking", action: "restore" }, { module: "booking", action: "transfer" },
    { module: "booking", action: "reject" },
    { module: "client_agreement", action: "view" }, { module: "client_agreement", action: "create" },
    { module: "client_agreement", action: "edit" },
    { module: "notification", action: "view" }, { module: "notification", action: "manage" },
    { module: "brand_management", action: "view" }, { module: "brand_management", action: "create" },
    { module: "brand_management", action: "edit" }, { module: "brand_management", action: "delete" },
    { module: "calendar_event", action: "view" }, { module: "calendar_event", action: "create" },
    { module: "calendar_event", action: "edit" }, { module: "calendar_event", action: "delete" },
    { module: "customers", action: "view" }, { module: "customers", action: "create" },
    { module: "customers", action: "edit" }, { module: "customers", action: "delete" },
    { module: "dashboard", action: "view" }, { module: "dashboard", action: "create" },
    { module: "dashboard", action: "edit" }, { module: "dashboard", action: "delete" },
    { module: "finance_ap", action: "view" }, { module: "finance_ap", action: "create" },
    { module: "finance_ap", action: "edit" }, { module: "finance_ap", action: "delete" },
    { module: "finance_ar", action: "view" }, { module: "finance_ar", action: "create" },
    { module: "finance_ar", action: "edit" }, { module: "finance_ar", action: "delete" },
    { module: "hr", action: "view" }, { module: "hr", action: "create" },
    { module: "hr", action: "edit" }, { module: "hr", action: "delete" },
    { module: "hr", action: "view_all" }, { module: "hr", action: "approve" },
    { module: "hr", action: "approve_manager" }, { module: "hr", action: "approve_finance" },
    { module: "hr", action: "approve_oprations" }, { module: "hr", action: "print" },
    { module: "hr", action: "mark_lost" }, { module: "hr", action: "restore" },
    { module: "package", action: "view" }, { module: "package", action: "create" },
    { module: "package", action: "edit" }, { module: "package", action: "delete" },
    { module: "payment_methods", action: "view" }, { module: "payment_methods", action: "create" },
    { module: "payment_methods", action: "edit" }, { module: "payment_methods", action: "delete" },
    { module: "role_permission", action: "view" }, { module: "role_permission", action: "create" },
    { module: "role_permission", action: "edit" }, { module: "role_permission", action: "delete" },
    { module: "settings", action: "view" }, { module: "settings", action: "create" },
    { module: "settings", action: "edit" }, { module: "settings", action: "delete" },
    { module: "source_of_information", action: "view" }, { module: "source_of_information", action: "create" },
    { module: "source_of_information", action: "edit" }, { module: "source_of_information", action: "delete" },
    { module: "user_management", action: "view" }, { module: "user_management", action: "create" },
    { module: "user_management", action: "edit" }, { module: "user_management", action: "delete" },
    { module: "vendor", action: "view" }, { module: "vendor", action: "create" },
    { module: "vendor", action: "edit" }, { module: "vendor", action: "delete" },
    { module: "venue_management", action: "view" }, { module: "venue_management", action: "create" },
    { module: "venue_management", action: "edit" }, { module: "venue_management", action: "delete" },
  ];

  for (const data of permissionData) {
    const existing = await prisma.permission.findUnique({ where: { module_action: { module: data.module, action: data.action } } });
    if (!existing) await prisma.permission.create({ data });
  }

  // Assign all permissions to Super Admin
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
    });
    if (!existing) await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: permission.id } });
  }

  console.log(`✅ ${roleData.length} Roles, ${permissionData.length} Permissions seeded`);
}

// Run standalone
if (process.argv[1].includes("roles-permissions")) {
  seedRolesPermissions()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
