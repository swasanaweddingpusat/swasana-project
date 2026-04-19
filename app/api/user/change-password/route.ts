import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { changePasswordSchema } from "@/lib/validations/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!mutationLimiter.check(`change-password:${session.user.id}`)) return rateLimitResponse();

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user?.password) {
      return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // currentPassword is always required
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      await logAudit({
        userId: session.user.id,
        action: "auth.password_change_failed",
        result: "failure",
        entityType: "profile",
        entityId: session.user.id,
        description: "Password lama tidak sesuai",
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
      return Response.json({ error: "Password saat ini tidak sesuai" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Neon HTTP adapter supports array-form transactions (not callback form)
    await db.$transaction([
      db.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
      }),
      db.profile.update({
        where: { userId: session.user.id },
        data: { mustChangePassword: false },
      }),
      // Invalidate all other sessions after password change
      db.session.deleteMany({
        where: { userId: session.user.id },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "auth.password_changed",
      result: "success",
      entityType: "profile",
      entityId: session.user.id,
      description: "Password berhasil diubah",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
