import bcrypt from "bcryptjs";
import { ProfileStatus } from "@prisma/client";
import { prisma } from "./_client";

const TEST_USERS = [
  { email: "manager@swasana.com", name: "Manager Test", roleName: "manager", password: "Manager@1234" },
  { email: "finance@swasana.com", name: "Finance Test", roleName: "finance", password: "Finance@1234" },
  { email: "sales@swasana.com", name: "Sales Test", roleName: "sales", password: "Sales@1234" },
];

export async function seedTestUsers() {
  const venues = await prisma.venue.findMany({ select: { id: true } });

  for (const u of TEST_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) { console.log(`⏭️  ${u.email} already exists, skipping`); continue; }

    const role = await prisma.role.findUnique({ where: { name: u.roleName } });
    if (!role) { console.error(`❌ Role "${u.roleName}" not found`); continue; }

    const hashedPassword = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.create({
      data: { email: u.email, name: u.name, password: hashedPassword, emailVerified: new Date() },
    });

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        email: user.email,
        fullName: u.name,
        roleId: role.id,
        dataScope: "all",
        status: ProfileStatus.active,
        isEmailVerified: true,
        mustChangePassword: false,
      },
    });

    for (const v of venues) {
      await prisma.userVenueAccess.create({ data: { userId: profile.id, venueId: v.id, scope: "general" } });
    }

    console.log(`✅ ${u.name} seeded: ${u.email} / ${u.password}`);
  }
}

// Run standalone
if (process.argv[1].includes("test-users")) {
  seedTestUsers()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
