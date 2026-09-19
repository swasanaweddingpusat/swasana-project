/**
 * Reset (or create) the admin@swasana.com super-admin account.
 * Safe to run multiple times — idempotent.
 *
 * Usage:
 *   npx tsx prisma/seeders/reset-admin.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "./_client";

const EMAIL = "admin@swasana.com";
const PASSWORD = "Admin@1234!";   // meets 12-char + upper/lower/number/symbol rule

async function resetAdmin() {
  // ── Clear lockout entries so login isn't blocked ──────────────────────────
  const deleted = await prisma.activityLog.deleteMany({
    where: { action: "auth.login_failed", entityId: EMAIL },
  });
  if (deleted.count > 0) console.log(`🔓 Cleared ${deleted.count} failed-login log entries`);

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  // ── Ensure super-admin role exists ────────────────────────────────────────
  let role = await prisma.role.findFirst({ where: { isSystemRole: true } });
  if (!role) {
    // Fallback: find any role with "super" or "admin" in the name
    role = await prisma.role.findFirst({
      where: { name: { contains: "admin" } },
    });
  }
  if (!role) {
    const allRoles = await prisma.role.findMany({ select: { id: true, name: true } });
    console.error("❌ No super-admin role found. Roles in DB:", allRoles);
    process.exit(1);
  }
  console.log(`✅ Using role: ${role.name} (isSystemRole=${role.isSystemRole})`);

  const existingUser = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { profile: true },
  });

  if (existingUser) {
    // ── Reset existing account ───────────────────────────────────────────────
    await prisma.user.update({
      where: { email: EMAIL },
      data: { password: hashedPassword, emailVerified: new Date() },
    });

    if (existingUser.profile) {
      await prisma.profile.update({
        where: { id: existingUser.profile.id },
        data: {
          status: "active",
          isEmailVerified: true,
          mustChangePassword: false,
          roleId: role.id,
          dataScope: "all",
        },
      });
    } else {
      await prisma.profile.create({
        data: {
          userId: existingUser.id,
          email: EMAIL,
          fullName: "Administrator",
          roleId: role.id,
          dataScope: "all",
          status: "active",
          isEmailVerified: true,
          mustChangePassword: false,
        },
      });
    }

    // Invalidate all existing sessions
    await prisma.session.deleteMany({ where: { userId: existingUser.id } });
    console.log(`✅ Admin account reset: ${EMAIL} / ${PASSWORD}`);
  } else {
    // ── Create fresh account ─────────────────────────────────────────────────
    const newUser = await prisma.user.create({
      data: {
        email: EMAIL,
        name: "Administrator",
        password: hashedPassword,
        emailVerified: new Date(),
      },
    });

    await prisma.profile.create({
      data: {
        userId: newUser.id,
        email: EMAIL,
        fullName: "Administrator",
        roleId: role.id,
        dataScope: "all",
        status: "active",
        isEmailVerified: true,
        mustChangePassword: false,
      },
    });
    console.log(`✅ Admin account created: ${EMAIL} / ${PASSWORD}`);
  }
}

if (process.argv[1]?.includes("reset-admin")) {
  resetAdmin()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
