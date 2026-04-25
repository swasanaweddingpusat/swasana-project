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
  const permResult = await requirePermission({ module: "settings", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!mutationLimiter.check(`invite:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const raw = {
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
    roleId: formData.get("roleId") as string,
    venueIds: JSON.parse(formData.get("venueIds") as string),
    venueScopes: JSON.parse((formData.get("venueScopes") as string) || "{}"),
    dataScope: (formData.get("dataScope") as string) || "own",
  };

  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, fullName, roleId, venueIds, venueScopes, dataScope } = parsed.data;

  try {
    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Email sudah terdaftar." };
    }

    // Temp password — never sent plain text. User sets own password via token link.
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Sequential writes — Neon HTTP adapter does NOT support nested creates (implicit transactions)
    const user = await db.user.create({
      data: { email, name: fullName, password: hashedPassword },
    });

    const profile = await db.profile.create({
      data: {
        userId: user.id,
        email,
        fullName,
        roleId,
        dataScope,
        isEmailVerified: false,
        mustChangePassword: true,
        invitedAt: new Date(),
      },
    });

    await db.emailVerificationToken.create({
      data: { profileId: profile.id, token, expiresAt },
    });

    if (venueIds.length > 0) {
      for (const venueId of venueIds) {
        await db.userVenueAccess.create({
          data: {
            userId: profile.id,
            venueId,
            scope: (venueScopes?.[venueId] ?? "individual") as "individual" | "general",
          },
        });
      }
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

    revalidateTag("users", "max");

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
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
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const {
    userId, fullName, nickName, phoneNumber, roleId, venueIds, venueScopes, status, dataScope,
    placeOfBirth, dateOfBirth, ktpAddress, currentAddress, motherName,
    maritalStatus, numberOfChildren, lastEducation,
    emergencyContactName, emergencyContactRel, emergencyContactPhone,
  } = parsed.data;

  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) return { success: false, error: "Pengguna tidak ditemukan." };

    // Diff venues (reads outside the transaction)
    const venueOps: Promise<unknown>[] = [];
    if (venueIds !== undefined) {
      const existing = await db.userVenueAccess.findMany({
        where: { userId },
        select: { venueId: true, scope: true },
      });
      const existingMap = new Map(existing.map((e: { venueId: string; scope: string }) => [e.venueId, e.scope]));
      const nextSet = new Set(venueIds);

      const toDelete = existing.filter((e: { venueId: string; scope: string }) => !nextSet.has(e.venueId));
      const toCreate = venueIds.filter((id) => !existingMap.has(id));
      const toUpdate = venueIds.filter((id) => {
        const cur = existingMap.get(id);
        const nxt = (venueScopes?.[id] ?? "individual") as "individual" | "general";
        return cur !== undefined && cur !== nxt;
      });

      for (const e of toDelete) {
        venueOps.push(
          db.userVenueAccess.delete({
            where: { userId_venueId: { userId, venueId: e.venueId } },
          })
        );
      }
      for (const venueId of toCreate) {
        venueOps.push(
          db.userVenueAccess.create({
            data: {
              userId,
              venueId,
              scope: (venueScopes?.[venueId] ?? "individual") as "individual" | "general",
            },
          })
        );
      }
      for (const venueId of toUpdate) {
        venueOps.push(
          db.userVenueAccess.update({
            where: { userId_venueId: { userId, venueId } },
            data: {
              scope: (venueScopes?.[venueId] ?? "individual") as "individual" | "general",
            },
          })
        );
      }
    }

    // Sequential writes — Neon HTTP adapter doesn't support $transaction
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
      await db.user.update({
        where: { id: profile.userId },
        data: { name: fullName },
      });
    }

    for (const op of venueOps) {
      await op;
    }

    revalidateTag("users", "max");

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
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
  const permResult = await requirePermission({ module: "settings", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };

  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) {
      return { success: false, error: "Pengguna tidak ditemukan." };
    }

    // Sequential deletes in FK order — HTTP adapter doesn't support $transaction
    await db.userVenueAccess.deleteMany({ where: { userId } });
    await db.emailVerificationToken.deleteMany({ where: { profileId: userId } });
    await db.passwordResetToken.deleteMany({ where: { userId } });
    await db.activityLog.deleteMany({ where: { userId } });
    await db.profile.delete({ where: { id: userId } });
    await db.user.delete({ where: { id: profile.userId } });

    revalidateTag("users", "max");

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

    // Invalidate existing tokens (updateMany not supported in Neon HTTP)
    const existingTokens = await db.emailVerificationToken.findMany({
      where: { profileId: userId, usedAt: null },
      select: { id: true },
    });
    for (const t of existingTokens) {
      await db.emailVerificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    }

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

export async function bulkUpdateUsers(data: {
  userIds: string[];
  roleId?: string;
  venueIds?: string[];
  venueScopes?: Record<string, "individual" | "general">;
  dataScope?: "own" | "group" | "all";
  groupIds?: string[];
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  const { session, error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`bulk-update-users:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const { userIds, roleId, venueIds, venueScopes, dataScope, groupIds } = data;
  if (!userIds.length) return { success: false, error: "Tidak ada user yang dipilih." };

  try {
    // userIds = auth user IDs → fetch profile IDs
    const profiles = await db.profile.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    });
    const profileIdMap = new Map(profiles.map((p: { userId: string; id: string }) => [p.userId, p.id]));

    // Build profile update ops (where: { userId } = auth user ID)
    const profileOps = userIds.map((userId) =>
      db.profile.update({
        where: { userId },
        data: {
          ...(roleId && { roleId }),
          ...(dataScope && { dataScope }),
        },
      })
    );

    // Profile updates in transaction
    await db.$transaction(profileOps);

    // Venue replace ops — sequential per user (outside transaction to avoid timeout)
    if (venueIds?.length) {
      for (const authUserId of userIds) {
        const profileId = profileIdMap.get(authUserId);
        if (!profileId) continue;
        await db.userVenueAccess.deleteMany({ where: { userId: profileId } });
        await db.$transaction(
          venueIds.map((venueId) =>
            db.userVenueAccess.create({
              data: { userId: profileId, venueId, scope: (venueScopes?.[venueId] ?? "individual") as "individual" | "general" },
            })
          )
        );
      }
    }

    // Group member replace — delete all existing then create new
    if (groupIds?.length) {
      for (const p of profiles) {
        await db.userGroupMember.deleteMany({ where: { userId: p.id } });
        await db.$transaction(
          groupIds.map((groupId, i) =>
            db.userGroupMember.create({ data: { groupId, userId: p.id, sortOrder: i } })
          )
        );
      }
    }

    await logAudit({
      userId: session!.user.id,
      action: "bulk_update_users",
      entityType: "user",
      entityId: userIds.join(","),
      changes: { roleId, venueIds, dataScope, groupIds, count: userIds.length },
      description: `Bulk updated ${userIds.length} users`,
    });

    revalidateTag("users", "max");
    return { success: true, updated: userIds.length };
  } catch {
    return { success: false, error: "Gagal mengupdate users." };
  }
}
