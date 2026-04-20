import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { PrismaClient, ProfileStatus } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

// Node.js doesn't have native WebSocket — use ws package
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Truncate (urutan penting: child tables dulu, baru parent) ────────────
  await prisma.activityLog.deleteMany();
  await prisma.userVenueAccess.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.brand.deleteMany();
  console.log("🗑️  Database truncated");

  // ─── Roles ────────────────────────────────────────────────────────────────
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
    await prisma.role.create({ data });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  console.log(`✅ ${roleData.length} Roles seeded`);

  // ─── Permissions (real data from production) ────────────────────────────────
  const permissionData: { module: string; action: string; description?: string }[] = [
    // attendance
    { module: "attendance", action: "view", description: "View own attendance records" },
    { module: "attendance", action: "create", description: "Create own attendance record (check-in)" },
    { module: "attendance", action: "edit", description: "Edit own attendance records" },
    { module: "attendance", action: "delete", description: "Delete own attendance records" },
    // booking
    { module: "booking", action: "view" },
    { module: "booking", action: "create" },
    { module: "booking", action: "edit" },
    { module: "booking", action: "delete" },
    { module: "booking", action: "print", description: "Print/generate PDF documents" },
    { module: "booking", action: "approve", description: "Approve/confirm booking" },
    { module: "booking", action: "approve_manager", description: "Approve PO as manager" },
    { module: "booking", action: "approve_finance", description: "Approve PO as finance" },
    { module: "booking", action: "approve_oprations", description: "Approve PO as oprations" },
    { module: "booking", action: "mark_lost", description: "Mark booking as lost" },
    { module: "booking", action: "restore", description: "Restore booking from lost/confirmed" },
    // brand_management
    { module: "brand_management", action: "view", description: "View brand management" },
    { module: "brand_management", action: "create", description: "Create brand management" },
    { module: "brand_management", action: "edit", description: "Edit brand management" },
    { module: "brand_management", action: "delete", description: "Delete brand management" },
    // calendar_event
    { module: "calendar_event", action: "view" },
    { module: "calendar_event", action: "create" },
    { module: "calendar_event", action: "edit" },
    { module: "calendar_event", action: "delete" },
    // customers
    { module: "customers", action: "view" },
    { module: "customers", action: "create" },
    { module: "customers", action: "edit" },
    { module: "customers", action: "delete" },
    // dashboard
    { module: "dashboard", action: "view" },
    { module: "dashboard", action: "create" },
    { module: "dashboard", action: "edit" },
    { module: "dashboard", action: "delete" },
    // addons
    { module: "addons", action: "view" },
    { module: "addons", action: "create" },
    { module: "addons", action: "edit" },
    { module: "addons", action: "delete" },
    // finance_ap
    { module: "finance_ap", action: "view" },
    { module: "finance_ap", action: "create" },
    { module: "finance_ap", action: "edit" },
    { module: "finance_ap", action: "delete" },
    // finance_ar
    { module: "finance_ar", action: "view" },
    { module: "finance_ar", action: "create" },
    { module: "finance_ar", action: "edit" },
    { module: "finance_ar", action: "delete" },
    // hr
    { module: "hr", action: "view", description: "View HR & Payroll menu" },
    { module: "hr", action: "create", description: "Create HR & Payroll data" },
    { module: "hr", action: "edit", description: "Edit HR & Payroll data" },
    { module: "hr", action: "delete", description: "Delete HR & Payroll data" },
    { module: "hr", action: "view_all", description: "View all HR & Payroll data" },
    { module: "hr", action: "approve", description: "Approve HR & Payroll requests" },
    { module: "hr", action: "approve_manager", description: "Approve HR & Payroll requests as manager" },
    { module: "hr", action: "approve_finance", description: "Approve HR & Payroll requests as finance" },
    { module: "hr", action: "approve_oprations", description: "Approve HR & Payroll requests as operations" },
    { module: "hr", action: "print", description: "Print HR & Payroll documents" },
    { module: "hr", action: "mark_lost", description: "Mark HR & Payroll record as lost" },
    { module: "hr", action: "restore", description: "Restore HR & Payroll record" },
    // package
    { module: "package", action: "view" },
    { module: "package", action: "create" },
    { module: "package", action: "edit" },
    { module: "package", action: "delete" },
    // payment_methods
    { module: "payment_methods", action: "view", description: "View payment methods" },
    { module: "payment_methods", action: "create", description: "Create payment methods" },
    { module: "payment_methods", action: "edit", description: "Edit payment methods" },
    { module: "payment_methods", action: "delete", description: "Delete payment methods" },
    // purchase_order
    { module: "purchase_order", action: "view" },
    { module: "purchase_order", action: "create" },
    { module: "purchase_order", action: "edit" },
    { module: "purchase_order", action: "delete" },
    // role_permission
    { module: "role_permission", action: "view", description: "View role & permission" },
    { module: "role_permission", action: "create", description: "Create role & permission" },
    { module: "role_permission", action: "edit", description: "Edit role & permission" },
    { module: "role_permission", action: "delete", description: "Delete role & permission" },
    // settings
    { module: "settings", action: "view" },
    { module: "settings", action: "create" },
    { module: "settings", action: "edit" },
    { module: "settings", action: "delete" },
    // source_of_information
    { module: "source_of_information", action: "view", description: "View source of information" },
    { module: "source_of_information", action: "create", description: "Create source of information" },
    { module: "source_of_information", action: "edit", description: "Edit source of information" },
    { module: "source_of_information", action: "delete", description: "Delete source of information" },
    // user_management
    { module: "user_management", action: "view" },
    { module: "user_management", action: "create" },
    { module: "user_management", action: "edit" },
    { module: "user_management", action: "delete" },
    // vendor
    { module: "vendor", action: "view" },
    { module: "vendor", action: "create" },
    { module: "vendor", action: "edit" },
    { module: "vendor", action: "delete" },
    // venue
    { module: "venue", action: "view" },
    { module: "venue", action: "create" },
    { module: "venue", action: "edit" },
    { module: "venue", action: "delete" },
    { module: "venue", action: "view_all", description: "View all venues (bypass venue assignment)" },
    // venue_management
    { module: "venue_management", action: "view", description: "View venue management" },
    { module: "venue_management", action: "create", description: "Create venue management" },
    { module: "venue_management", action: "edit", description: "Edit venue management" },
    { module: "venue_management", action: "delete", description: "Delete venue management" },
  ];

  for (const data of permissionData) {
    await prisma.permission.create({ data });
  }

  // Dynamically assign ALL permissions to Super Admin
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  console.log(`✅ ${permissionData.length} Permissions seeded & all assigned to Super Admin`);

  // ─── Brands ───────────────────────────────────────────────────────────────
  const brandSwn = await prisma.brand.create({ data: { name: "Swasana Venue Mastery", code: "SWN" } });
  const brandGnw = await prisma.brand.create({ data: { name: "Gunawarman Hallmark & Event", code: "GNW" } });
  const brandPbn = await prisma.brand.create({ data: { name: "Pakubuwono Event Artistry", code: "PBN" } });
  console.log("✅ 3 Brands seeded");

  // ─── Venues ───────────────────────────────────────────────────────────────
  // SWN venues: BRIN Thamrin (SBT), BRIN Gatot Subroto (SBG), Seskoad (SSK),
  //             Dharmagati (SDG), Lippo Kuningan (SLK), Patrajasa (SPJ), Grand Slipi (SGS)
  // GNW venues: Menara Bripens (GMP)
  // PBN venues: Paramita (PKP), Samisara Sopodel (GSS)
  const venueInputs = [
    { name: "BRIN Thamrin",        code: "SBT", capacity: 800, address: "Jl. M.H. Thamrin No.8, Jakarta Pusat",                  brandId: brandSwn.id },
    { name: "BRIN Gatot Subroto",  code: "SBG", capacity: 800, address: "Jl. Gatot Subroto No.10, Jakarta Selatan",               brandId: brandSwn.id },
    { name: "Seskoad",             code: "SSK", capacity: 800, address: "Jl Gatot Subroto No. 96, Bandung",                       brandId: brandSwn.id },
    { name: "Dharmagati",          code: "SDG", capacity: 800, address: "Jl. Raya Jakarta-Bogor, Jakarta Timur",                  brandId: brandSwn.id },
    { name: "Lippo Kuningan",      code: "SLK", capacity: 800, address: "Jl. HR. Rasuna Said Kav. B12, Jakarta Selatan",          brandId: brandSwn.id },
    { name: "Patrajasa",           code: "SPJ", capacity: 800, address: "Jl. Gatot Subroto No.Kav 32-34, Jakarta Selatan",        brandId: brandSwn.id },
    { name: "Grand Slipi",         code: "SGS", capacity: 800, address: "Jl. Letjen S. Parman, Jakarta Barat",                    brandId: brandSwn.id },
    { name: "Menara Bripens",      code: "GMP", capacity: 800, address: "Jl. Gatot Subroto, Jakarta Selatan",                     brandId: brandGnw.id },
    { name: "Samisara Sopodel",    code: "GSS", capacity: 800, address: "Jl.Mega Kuningan Barat III No.1-6, Jakarta Selatan",     brandId: brandPbn.id },
    { name: "Paramita",            code: "PKP", capacity: 800, address: "Jl.Boulevard Raya Sektor 7 Bintaro",                     brandId: brandPbn.id },
  ];

  const venues = [];
  for (const data of venueInputs) {
    const venue = await prisma.venue.create({ data: { ...data, isActive: true } });
    venues.push(venue);
  }
  console.log(`✅ ${venues.length} Venues seeded`);

  // ─── Admin User ───────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Admin@1234", 12);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@swasana.com",
      name: "Administrator",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const adminProfile = await prisma.profile.create({
    data: {
      userId: adminUser.id,
      email: adminUser.email,
      fullName: "Administrator",
      roleId: adminRole.id,
      dataScope: "all",
      status: ProfileStatus.active,
      isEmailVerified: true,
      mustChangePassword: false,
    },
  });

  // Assign admin ke SEMUA venues
  for (const v of venues) {
    await prisma.userVenueAccess.create({
      data: {
        userId: adminProfile.id,
        venueId: v.id,
        scope: "general",
      },
    });
  }

  console.log("✅ Admin user seeded: admin@swasana.com / Admin@1234");
  console.log("\n🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
