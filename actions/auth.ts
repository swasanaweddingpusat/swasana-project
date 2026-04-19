"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { logAudit } from "@/lib/audit";
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

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { email } = parsed.data;

  try {
    const profile = await db.profile.findUnique({ where: { email } });

    if (profile) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      await db.passwordResetToken.create({
        data: {
          userId: profile.id,
          token,
          expiresAt,
        },
      });

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

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
    include: { profile: true },
  });

  if (!resetToken) {
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
  ]);

  revalidateTag("users");

  const h = await headers();
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
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string) {
  if (!token) {
    return { success: false, error: "Token tidak valid." };
  }

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

  await db.$transaction([
    db.profile.update({
      where: { id: verificationToken.profileId },
      data: { isEmailVerified: true },
    }),
    db.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logAudit({
    userId: verificationToken.profileId,
    action: "auth.email_verified",
    entityType: "profile",
    entityId: verificationToken.profileId,
    description: "Email berhasil diverifikasi",
  });

  return { success: true, message: "Email berhasil diverifikasi." };
}
