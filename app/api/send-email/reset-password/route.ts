import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { ResetPasswordEmail } from "../components/reset-password-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generate token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Invalidate old tokens
    await db.passwordResetToken.updateMany({
      where: { userId: user.profile!.id, used: false },
      data: { used: true },
    });

    // Create new token
    await db.passwordResetToken.create({
      data: {
        userId: user.profile!.id,
        token,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: "Reset Password - Swasana Wedding",
      react: ResetPasswordEmail({
        resetUrl,
        userName: user.profile?.fullName ?? user.name ?? "Pengguna",
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Gagal mengirim email reset password" },
      { status: 500 }
    );
  }
}
