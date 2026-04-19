import { db } from "@/lib/db";
import { authLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!authLimiter.check(`validate-token:${ip}`)) return rateLimitResponse();

  try {
    const { token } = await request.json();

    if (!token) {
      return Response.json({ valid: false, error: "Token tidak ditemukan" }, { status: 400 });
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return Response.json({ valid: false, error: "Token tidak valid" }, { status: 400 });
    }

    if (resetToken.usedAt) {
      return Response.json({ valid: false, error: "Token sudah digunakan" }, { status: 400 });
    }

    if (new Date() > resetToken.expiresAt) {
      return Response.json({ valid: false, error: "Token sudah kedaluwarsa" }, { status: 400 });
    }

    // Never return email — prevents account enumeration
    return Response.json({ valid: true });
  } catch {
    return Response.json({ valid: false, error: "Terjadi kesalahan" }, { status: 500 });
  }
}
