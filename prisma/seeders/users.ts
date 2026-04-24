import bcrypt from "bcryptjs";
import { ProfileStatus } from "@prisma/client";
import { prisma } from "./_client";

export async function seedUsers() {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  const venues = await prisma.venue.findMany({ select: { id: true } });

  const existing = await prisma.user.findUnique({ where: { email: "admin@swasana.com" } });
  if (existing) { console.log("⏭️  Admin user already exists, skipping"); return; }

  const hashedPassword = await bcrypt.hash("Admin@1234", 12);
  const adminUser = await prisma.user.create({
    data: { email: "admin@swasana.com", name: "Administrator", password: hashedPassword, emailVerified: new Date() },
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

  for (const v of venues) {
    await prisma.userVenueAccess.create({ data: { userId: adminProfile.id, venueId: v.id, scope: "general" } });
  }

  console.log("✅ Admin user seeded: admin@swasana.com / Admin@1234");
}

// Run standalone
if (process.argv[1].includes("users")) {
  seedUsers()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
