"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { inviteUserSchema, updateUserSchema } from "@/lib/validations/user";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import crypto from "crypto";
import { invitationEmailHtml } from "@/emails/invitation-email";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

// ─── Invite User ──────────────────────────────────────────────────────────────

export async function inviteUser(formData: FormData) {
  const { session, error: authError } = await requirePermission({ module: "settings", action: "create" });
  if (authError) return { success: false, error: authError };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!mutationLimiter.check(`invite:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const raw = {
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
    roleId: formData.get("roleId") as string,
    venueIds: JSON.parse(formData.get("venueIds") as string),
    dataScope: (formData.get("dataScope") as string) || "own",
  };

  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { email, fullName, roleId, venueIds, dataScope } = parsed.data;

  try {
    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Email sudah terdaftar." };
    }

    // Temp password is hashed — never sent plain text. User sets own password via token link.
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Create user + profile atomically
    const user = await db.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        profile: {
          create: {
            email,
            fullName,
            roleId,
            dataScope,
            isEmailVerified: false,
            mustChangePassword: true,
            invitedAt: new Date(),
            emailVerificationTokens: {
              create: { token, expiresAt },
            },
          },
        },
      },
      include: { profile: true },
    });

    const profile = user.profile!;

    // Create venue access entries
    if (venueIds.length > 0) {
      await db.$transaction(
        venueIds.map((venueId) =>
          db.userVenueAccess.create({ data: { userId: profile.id, venueId } })
        )
      );
    }

    // Send invitation email — OUTSIDE the DB write so a mail failure doesn't roll back user creation
    const baseUrl = await getBaseUrl();
    const verificationLink = `${baseUrl}/auth/verify?token=${token}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Undangan Bergabung — Swasana",
      html: invitationEmailHtml({ fullName, verificationLink }),
    });

    revalidateTag("users");

    const h = await headers();
    await logAudit({
      userId: session.user.id,
      action: "user.invited",
      entityType: "profile",
      entityId: profile.id,
      description: `Pengguna ${email} diundang`,
      changes: { after: { email, fullName, roleId, dataScope } },
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, message: "Undangan berhasil dikirim." };
  } catch (error) {
    console.error("[inviteUser] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat mengundang pengguna." };
  }
}

// ─── Update User ──────────────────────────────────────────────────────────────

export async function updateUser(data: Record<string, unknown>) {
  const { session, error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { success: false, error: authError };

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const {
    userId, fullName, nickName, phoneNumber, roleId, venueIds, status, dataScope,
    placeOfBirth, dateOfBirth, ktpAddress, currentAddress, motherName,
    maritalStatus, numberOfChildren, lastEducation,
    emergencyContactName, emergencyContactRel, emergencyContactPhone,
  } = parsed.data;

  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) return { success: false, error: "Pengguna tidak ditemukan." };

    await db.profile.update({
      where: { id: userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(nickName !== undefined && { nickName }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(roleId !== undefined && { roleId }),
        ...(status !== undefined && { status }),
        ...(dataScope !== undefined && { dataScope }),
        ...(placeOfBirth !== undefined && { placeOfBirth }),
        ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
        ...(ktpAddress !== undefined && { ktpAddress }),
        ...(currentAddress !== undefined && { currentAddress }),
        ...(motherName !== undefined && { motherName }),
        ...(maritalStatus !== undefined && { maritalStatus }),
        ...(numberOfChildren !== undefined && { numberOfChildren }),
        ...(lastEducation !== undefined && { lastEducation }),
        ...(emergencyContactName !== undefined && { emergencyContactName }),
        ...(emergencyContactRel !== undefined && { emergencyContactRel }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
      },
    });

    if (fullName !== undefined) {
      await db.user.update({ where: { id: profile.userId }, data: { name: fullName } });
    }

    if (venueIds !== undefined) {
      await db.userVenueAccess.deleteMany({ where: { userId } });
      if (venueIds.length > 0) {
        await db.$transaction(
          venueIds.map((venueId) =>
            db.userVenueAccess.create({ data: { userId, venueId } })
          )
        );
      }
    }

    revalidateTag("users");

    const h = await headers();
    await logAudit({
      userId: session.user.id,
      action: "user.updated",
      entityType: "profile",
      entityId: userId,
      description: "Data pengguna diperbarui",
      changes: { after: { fullName, roleId, status, dataScope } },
      ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, message: "Data pengguna berhasil diperbarui." };
  } catch (error) {
    console.error("[updateUser] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat memperbarui pengguna." };
  }
}

// ─── Delete User ──────────────────────────────────────────────────────────────

export async function deleteUser(userId: string) {
  const { error: authError } = await requirePermission({ module: "settings", action: "delete" });
  if (authError) return { success: false, error: authError };

  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) {
      return { success: false, error: "Pengguna tidak ditemukan." };
    }

    // Delete in FK order — array transaction ensures atomicity on Neon HTTP
    await db.$transaction([
      db.userVenueAccess.deleteMany({ where: { userId } }),
      db.emailVerificationToken.deleteMany({ where: { profileId: userId } }),
      db.passwordResetToken.deleteMany({ where: { userId } }),
      db.activityLog.deleteMany({ where: { userId } }),
      db.profile.delete({ where: { id: userId } }),
      db.user.delete({ where: { id: profile.userId } }),
    ]);

    revalidateTag("users");

    const h = await headers();
    await logAudit({
      action: "user.deleted",
      entityType: "profile",
      entityId: userId,
      description: `Pengguna ${profile.email} dihapus`,
      changes: { before: { email: profile.email, fullName: profile.fullName } },
      ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, message: "Pengguna berhasil dihapus." };
  } catch (error) {
    console.error("[deleteUser] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat menghapus pengguna." };
  }
}

// ─── Resend Invitation ────────────────────────────────────────────────────────

export async function resendInvitation(userId: string) {
  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) {
      return { success: false, error: "Pengguna tidak ditemukan." };
    }

    if (profile.isEmailVerified) {
      return { success: false, error: "Email pengguna sudah diverifikasi." };
    }

    // Invalidate existing tokens
    await db.emailVerificationToken.updateMany({
      where: { profileId: userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await db.emailVerificationToken.create({
      data: {
        profileId: userId,
        token,
        expiresAt,
      },
    });

    // Send invitation email
    const baseUrl = await getBaseUrl();
    const verificationLink = `${baseUrl}/auth/verify?token=${token}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: profile.email,
      subject: "Undangan Bergabung (Kirim Ulang) — Swasana",
      html: invitationEmailHtml({
        fullName: profile.fullName ?? profile.email,
        verificationLink,
      }),
    });

    return { success: true, message: "Undangan berhasil dikirim ulang." };
  } catch (error) {
    console.error("[resendInvitation] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat mengirim ulang undangan." };
  }
}
