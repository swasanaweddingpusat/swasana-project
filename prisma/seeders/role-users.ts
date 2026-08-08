import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { DataScope, ProfileStatus } from "@prisma/client";
import { prisma } from "./_client";

// ── Role-based login accounts ────────────────────────────────────────────
// One account per operational role, for dev/staging testing & demo.
// Roles referenced here MUST already exist (seeded by roles-permissions.ts).
// Passwords are policy-compliant (AGENTS §4.6: min 12, upper/lower/digit/symbol,
// not containing the app name). They are NEVER logged — see report/handover.
interface RoleUserSeed {
  email: string;
  name: string;
  roleName: string; // must match Role.name (kebab-case) in roles-permissions.ts
  password: string;
  dataScope: DataScope;
}

const ROLE_USERS: RoleUserSeed[] = [
  { email: "sales@swasana.com", name: "Sales", roleName: "sales", password: "SalesPass@2026", dataScope: DataScope.own },
  { email: "manager@swasana.com", name: "Manager", roleName: "manager", password: "ManagerPass@2026", dataScope: DataScope.all },
  { email: "finance@swasana.com", name: "Finance", roleName: "finance", password: "FinancePass@2026", dataScope: DataScope.all },
  { email: "sales-mice@swasana.com", name: "Sales MICE", roleName: "sales-mice", password: "SalesMicePass@2026", dataScope: DataScope.own },
  { email: "manager-mice@swasana.com", name: "Manager MICE", roleName: "manager-mice", password: "ManagerMicePass@2026", dataScope: DataScope.all },
];

export async function seedRoleUsers(): Promise<void> {
  for (const u of ROLE_USERS) {
    // Idempotent: skip if the account already exists.
    const existing = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (existing) {
      console.error(`⏭️  ${u.email} already exists, skipping`);
      continue;
    }

    const role = await prisma.role.findUnique({ where: { name: u.roleName }, select: { id: true } });
    if (!role) {
      console.error(`❌ Role "${u.roleName}" not found — run "npm run db:seed:roles-permissions" first`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(u.password, 12);
    const userId = randomUUID();

    // Atomic multi-table write (AGENTS §4.2): user + profile in one $transaction.
    // Explicit userId lets the profile FK resolve within the same batch.
    await prisma.$transaction([
      prisma.user.create({
        data: {
          id: userId,
          email: u.email,
          name: u.name,
          password: hashedPassword,
          emailVerified: new Date(),
        },
      }),
      prisma.profile.create({
        data: {
          userId,
          email: u.email,
          fullName: u.name,
          roleId: role.id,
          dataScope: u.dataScope,
          status: ProfileStatus.active,
          isEmailVerified: true,
          mustChangePassword: false,
        },
      }),
    ]);

    // Never log the plaintext password (AGENTS §4.6).
    console.error(`✅ ${u.name} seeded: ${u.email} (role: ${u.roleName}, scope: ${u.dataScope})`);
  }
}

// Run standalone: npm run db:seed:role-users
if (process.argv[1]?.includes("role-users")) {
  seedRoleUsers()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
