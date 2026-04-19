import { db } from "@/lib/db";
import { authLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!authLimiter.check(`reset-password:${ip}`)) return rateLimitResponse();

  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return Response.json({ error: "Token dan password wajib diisi" }, { status: 400 });
    }

    if (password.length < 12) {
      return Response.json({ error: "Password minimal 12 karakter" }, { status: 400 });
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { profile: true },
    });

    if (!resetToken || resetToken.usedAt || new Date() > resetToken.expiresAt) {
      return Response.json({ error: "Token tidak valid atau sudah kedaluwarsa" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Neon HTTP adapter supports array-form transactions (not callback form)
    await db.$transaction([
      db.user.update({
        where: { id: resetToken.profile.userId },
        data: { password: hashedPassword },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      db.profile.update({
        where: { id: resetToken.userId },
        data: { mustChangePassword: false },
      }),
    ]);

    await logAudit({
      userId: resetToken.userId,
      action: "auth.password_reset",
      result: "success",
      entityType: "profile",
      entityId: resetToken.userId,
      description: "Password direset via link",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
