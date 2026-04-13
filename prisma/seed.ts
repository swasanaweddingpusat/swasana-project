import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

// Enable WebSocket for Node.js (needed for PrismaNeon transactions)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Seed Roles
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: {
      name: "admin",
      description: "Administrator dengan akses penuh",
      sortOrder: 1,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: "manager" },
    update: {},
    create: {
      name: "manager",
      description: "Manager dengan akses terbatas",
      sortOrder: 2,
    },
  });

  await prisma.role.upsert({
    where: { name: "sales" },
    update: {},
    create: {
      name: "sales",
      description: "Sales team",
      sortOrder: 3,
    },
  });

  console.log("✅ Roles seeded");

  // Seed Permissions
  const modules = [
    "bookings",
    "customers",
    "vendors",
    "venues",
    "packages",
    "finance",
    "hr",
    "settings",
    "reports",
  ];
  const actions = ["view", "create", "update", "delete"];

  for (const module of modules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action },
      });
    }
  }

  console.log("✅ Permissions seeded");

  // Assign all permissions to admin
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log("✅ Admin permissions assigned");

  // Seed admin user
  const hashedPassword = await bcrypt.hash("Admin@1234", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@swasana.com" },
    update: {},
    create: {
      email: "admin@swasana.com",
      name: "Administrator",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  await prisma.profile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      email: adminUser.email,
      fullName: "Administrator",
      roleId: adminRole.id,
      isEmailVerified: true,
      mustChangePassword: true,
    },
  });

  console.log("✅ Admin user seeded: admin@swasana.com / Admin@1234");

  // Seed Brands
  const brand = await prisma.brand.upsert({
    where: { code: "SWS" },
    update: {},
    create: {
      name: "Swasana Wedding",
      code: "SWS",
    },
  });

  console.log("✅ Brand seeded");

  // Seed Venue
  const venue = await prisma.venue.upsert({
    where: { id: "default-venue" },
    update: {},
    create: {
      id: "default-venue",
      name: "Swasana Grand Ballroom",
      brandId: brand.id,
      capacity: 500,
      isActive: true,
    },
  });

  console.log("✅ Venue seeded");

  // Seed Source of Information
  const sources = [
    "Instagram",
    "Facebook",
    "Google",
    "Referral Teman",
    "Wedding Exhibition",
    "Walk In",
    "Lainnya",
  ];

  for (const name of sources) {
    await prisma.sourceOfInformation.upsert({
      where: { id: name.toLowerCase().replace(/\s/g, "-") },
      update: {},
      create: {
        id: name.toLowerCase().replace(/\s/g, "-"),
        name,
      },
    });
  }

  console.log("✅ Source of information seeded");

  // Seed Vendor Categories
  const vendorCategories = [
    { name: "Katering", description: "Vendor katering makanan dan minuman" },
    { name: "Dekorasi", description: "Vendor dekorasi venue" },
    { name: "Rias & Busana", description: "Vendor rias pengantin dan busana" },
    { name: "Dokumentasi", description: "Vendor foto dan video" },
    { name: "Entertainment", description: "Vendor hiburan dan band" },
    { name: "Lainnya", description: "Vendor kategori lainnya" },
  ];

  for (const cat of vendorCategories) {
    await prisma.vendorCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log("✅ Vendor categories seeded");

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
