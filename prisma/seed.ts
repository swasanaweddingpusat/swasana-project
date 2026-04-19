import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { PrismaClient, ProfileStatus } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {
  arrayMode: false,
  fullResults: false,
});
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
  console.log("🗑️  Database truncated");

  // ─── Roles ────────────────────────────────────────────────────────────────
  const roleData = [
    { name: "admin", description: "Administrator dengan akses penuh", sortOrder: 1 },
    { name: "manager", description: "Manager dengan akses terbatas", sortOrder: 2 },
    { name: "sales", description: "Sales team", sortOrder: 3 },
  ];

  for (const data of roleData) {
    await prisma.role.create({ data });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
  console.log("✅ Roles seeded");

  // ─── Permissions ──────────────────────────────────────────────────────────
  const modules = [
    "bookings", "customers", "vendors", "venues", "packages",
    "finance", "hr", "settings", "reports",
  ];
  const actions = ["view", "create", "update", "delete"];

  for (const moduleName of modules) {
    for (const action of actions) {
      await prisma.permission.create({ data: { module: moduleName, action } });
    }
  }

  // Assign all permissions to admin
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  console.log("✅ Permissions seeded & assigned to admin");

  // ─── Venues ───────────────────────────────────────────────────────────────
  const venue = await prisma.venue.create({
    data: {
      id: "venue-swasana-grand",
      name: "Swasana Grand Ballroom",
      capacity: 500,
      isActive: true,
    },
  });

  console.log("✅ Venue seeded");

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
      status: ProfileStatus.active,
      isEmailVerified: true,
      mustChangePassword: false,
    },
  });

  // Assign admin ke venue
  await prisma.userVenueAccess.create({
    data: {
      userId: adminProfile.id,
      venueId: venue.id,
      scope: "general",
    },
  });

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
