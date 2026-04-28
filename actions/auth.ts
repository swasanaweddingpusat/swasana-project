"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { logAudit } from "@/lib/audit";
import { authLimiter, rateLimitError } from "@/lib/rate-limit";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import crypto from "crypto";
import { resetPasswordEmailHtml } from "@/emails/reset-password-email";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
  };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!authLimiter.check(`forgot-pw:${ip}`)) return { success: false, ...rateLimitError() };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email } = parsed.data;

  try {
    const profile = await db.profile.findUnique({ where: { email } });

    if (profile) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      await db.$transaction([
        db.passwordResetToken.create({
          data: {
            userId: profile.id,
            token,
            expiresAt,
          },
        }),
      ]);

      const baseUrl = await getBaseUrl();
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Reset Password — Swasana",
        html: resetPasswordEmailHtml({ resetLink }),
      });
    }
  } catch (error) {
    console.error("[forgotPassword] Error:", error);
  }

  // Always return success to prevent email enumeration
  return {
    success: true,
    message:
      "Jika email terdaftar, link reset password telah dikirim ke email Anda.",
  };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(formData: FormData) {
  const raw = {
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };
  const token = formData.get("token") as string;
  const force = formData.get("force") === "true";

  if (!token) {
    return { success: false, error: "Token tidak valid." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!authLimiter.check(`reset-pw:${ip}`)) return { success: false, ...rateLimitError() };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { profile: true },
    });

    if (!resetToken) {
      console.error("[resetPassword] Token not found:", token.substring(0, 20) + "...");
      return { success: false, error: "Token tidak valid atau sudah digunakan." };
    }

    if (resetToken.usedAt) {
      return { success: false, error: "Token sudah digunakan." };
    }

    if (resetToken.expiresAt < new Date()) {
      return { success: false, error: "Token sudah kadaluarsa." };
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.profile.userId },
        data: { password: hashedPassword },
      }),
      db.profile.update({
        where: { id: resetToken.userId },
        data: force ? { mustChangePassword: false } : {},
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      db.session.deleteMany({
        where: { userId: resetToken.profile.userId },
      }),
    ]);

    revalidateTag("users", "max");

    await logAudit({
      userId: resetToken.userId,
      action: "auth.password_changed",
      entityType: "profile",
      entityId: resetToken.userId,
      description: force ? "Password sementara diganti (force reset)" : "Password direset",
      ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, message: "Password berhasil diubah." };
  } catch (e) {
    console.error("[resetPassword]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string) {
  if (!token) {
    return { success: false, error: "Token tidak valid." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!authLimiter.check(`verify-email:${ip}`)) return { success: false, ...rateLimitError() };

  try {
    const verificationToken = await db.emailVerificationToken.findUnique({
      where: { token },
      include: { profile: true },
    });

    if (!verificationToken) {
      return { success: false, error: "Token tidak valid atau sudah digunakan." };
    }

    if (verificationToken.usedAt) {
      return { success: false, error: "Token sudah digunakan." };
    }

    if (verificationToken.expiresAt < new Date()) {
      return { success: false, error: "Token sudah kadaluarsa." };
    }

    // Generate password setup token so user can set their password
    const cryptoMod = await import("crypto");
    const rawToken = cryptoMod.randomBytes(32).toString("hex");

    await db.$transaction([
      db.profile.update({
        where: { id: verificationToken.profileId },
        data: { isEmailVerified: true },
      }),
      db.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
      db.passwordResetToken.create({
        data: {
          userId: verificationToken.profileId,
          token: rawToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      }),
    ]);

    await logAudit({
      userId: verificationToken.profileId,
      action: "auth.email_verified",
      entityType: "profile",
      entityId: verificationToken.profileId,
      description: "Email berhasil diverifikasi",
    });

    return { success: true, setupToken: rawToken, message: "Email berhasil diverifikasi." };
  } catch (e) {
    console.error("[verifyEmail]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
