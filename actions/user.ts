"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { inviteUserSchema, updateUserSchema } from "@/lib/validations/user";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { invitationEmailHtml } from "@/emails/invitation-email";
import { getResendClient } from "@/lib/resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

// ─── Invite User ──────────────────────────────────────────────────────────────

export async function inviteUser(formData: FormData) {
  const { session, error: permError } = await requirePermission({ module: "settings-users", action: "create" });
  if (permError) return { success: false, error: permError };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  if (!mutationLimiter.check(`invite:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const rawGroupIds = formData.getAll("groupIds").map(String).filter(Boolean);

  const raw = {
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
    roleId: formData.get("roleId") as string,
    managerId: (formData.get("managerId") as string) || undefined,
    dataScope: (formData.get("dataScope") as string) || "own",
    groupIds: rawGroupIds.length > 0 ? rawGroupIds : undefined,
  };

  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, fullName, roleId, managerId, dataScope, groupIds } = parsed.data;

  try {
    // Temp password — never sent plain text. User sets own password via token link.
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Nested create is atomic on Neon HTTP adapter — avoids callback transaction form.
    // Unique constraint on user.email acts as the race-condition guard; P2002 is caught below.
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
            managerId: managerId ?? null,
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
      select: { id: true, profile: { select: { id: true } } },
    });

    const profileId = user.profile!.id;

    // Create group memberships if dataScope is "group" and groupIds were provided
    if (groupIds && groupIds.length > 0) {
      await db.$transaction(
        groupIds.map((groupId, i) =>
          db.userGroupMember.create({ data: { groupId, userId: profileId, sortOrder: i } })
        )
      );
    }

    // Send invitation email — outside DB write so mail failure doesn't roll back user creation
    const baseUrl = await getBaseUrl();
    const verificationLink = `${baseUrl}/auth/verify?token=${token}`;

    await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Undangan Bergabung — Swasana",
      html: invitationEmailHtml({ fullName, verificationLink }),
    });

    revalidateTag("users", "max");

    await logAudit({
      userId: session!.user.profileId,
      action: "user.invited",
      entityType: "profile",
      entityId: profileId,
      description: `Pengguna ${email} diundang`,
      changes: { after: { email, fullName, roleId, dataScope, groupIds } },
      ipAddress: ip,
      userAgent: (await headers()).get("user-agent") ?? undefined,
    });

    return { success: true, message: "Undangan berhasil dikirim." };
  } catch (error) {
    // P2002 = unique constraint violation. Inspect meta.target to report the
    // right cause — not every P2002 is a duplicate email. The Profile table also
    // has unique constraints on `employeeNumber` (autoincrement) and `email`, so
    // an out-of-sync sequence surfaces here as employeeNumber, not email.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const target = (error as { meta?: { target?: unknown } }).meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : typeof target === "string"
          ? [target]
          : [];
      const hit = (name: string) => fields.some((f) => f.toLowerCase().includes(name));

      if (hit("email")) {
        return { success: false, error: "Email sudah terdaftar." };
      }
      // employeeNumber collision = sequence out of sync at the DB level, not a
      // user-input problem. Surface it explicitly so it isn't misread as a dup email.
      console.error("[inviteUser] P2002 on non-email constraint:", fields);
      return {
        success: false,
        error: "Gagal membuat pengguna karena konflik data internal. Hubungi administrator.",
      };
    }
    console.error("[inviteUser] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat mengundang pengguna." };
  }
}

// ─── Update User ──────────────────────────────────────────────────────────────

export async function updateUser(data: Record<string, unknown>) {
  const { session, error: permError } = await requirePermission({ module: "settings-users", action: "edit" });
  if (permError) return { success: false, error: permError };
  if (!mutationLimiter.check(`user-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const {
    userId, fullName, nickName, phoneNumber, roleId, managerId, status, dataScope,
    placeOfBirth, dateOfBirth, ktpAddress, currentAddress, motherName,
    maritalStatus, numberOfChildren, lastEducation,
    emergencyContactName, emergencyContactRel, emergencyContactPhone,
  } = parsed.data;

  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) return { success: false, error: "Pengguna tidak ditemukan." };

    await db.$transaction([
      db.profile.update({
        where: { id: userId },
        data: {
          ...(fullName !== undefined && { fullName }),
          ...(nickName !== undefined && { nickName }),
          ...(phoneNumber !== undefined && { phoneNumber }),
          ...(roleId !== undefined && { roleId }),
          ...(managerId !== undefined && { managerId: managerId || null }),
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
      }),
      ...(fullName !== undefined
        ? [db.user.update({ where: { id: profile.userId }, data: { name: fullName } })]
        : []),
    ]);

    revalidateTag("users", "max");

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
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
  const { session, error: permError } = await requirePermission({ module: "settings-users", action: "delete" });
  if (permError) return { success: false, error: permError };
  if (!mutationLimiter.check(`user-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { id: true, userId: true, email: true, fullName: true, status: true },
    });
    if (!profile) {
      return { success: false, error: "Pengguna tidak ditemukan." };
    }

    const h = await headers();
    const ipAddress = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined;
    const userAgent = h.get("user-agent") ?? undefined;

    // A Profile can be referenced by booking.salesId, quotation.salesId,
    // lead.createdById, approvalRecord, bookingRevision, bookingComment,
    // userTarget and maintenanceTicket — all with `onDelete: Restrict`. Those
    // rows are business records that must not be orphaned, so a hard delete is
    // refused by Postgres (FK violation).
    //
    // Strategy: try the hard delete; if any Restrict relation blocks it, fall
    // back to detach + soft delete — the sales is unassigned from their bookings
    // (salesId → null, "tanpa PIC", ready to transfer to another sales) and the
    // account is disabled (status → inactive). The financial/approval audit trail
    // (ledger, approval signatures, quotations) is preserved intact. Sessions are
    // cleared in both paths so the user can no longer authenticate.
    try {
      // Cascades from User → Profile (onDelete: Cascade) handle
      // EmailVerificationToken, PasswordResetToken, UserGroupMember, Notification etc.
      // ActivityLog rows are kept (onDelete: SetNull nullifies their userId).
      await db.$transaction([
        db.session.deleteMany({ where: { userId: profile.userId } }),
        db.user.delete({ where: { id: profile.userId } }),
      ]);

      revalidateTag("users", "max");
      await logAudit({
        userId: session!.user.profileId,
        action: "user.deleted",
        entityType: "profile",
        entityId: userId,
        description: `Pengguna ${profile.email} dihapus`,
        changes: { before: { email: profile.email, fullName: profile.fullName } },
        ipAddress,
        userAgent,
      });

      return { success: true, message: "Pengguna berhasil dihapus." };
    } catch (err) {
      // Foreign-key constraint violation → user has linked business records.
      // Soft delete instead of failing. Detect via helper so BOTH Prisma's
      // "P2003" and the raw Postgres "23503" are caught — with the PrismaPg/Neon
      // driver adapter the SQLSTATE can bubble up unmapped, and a P2003-only
      // check silently missed it (the "Terjadi kesalahan" bug).
      if (!isForeignKeyViolation(err)) throw err;

      // Count the bookings this sales owns so the message can tell the admin how
      // many are now "tanpa PIC" and need transferring. Covers both WEDDINGS and
      // MICE (same bookings table).
      const detachedCount = await db.booking.count({ where: { salesId: profile.id } });
      const wasAlreadyInactive = profile.status === "inactive";

      // NB: do NOT early-return when the profile is already inactive. A profile
      // deactivated by an older code path (before booking-detach existed) can
      // still own bookings, and Postgres keeps refusing the hard delete until
      // they're detached. Re-running the detach here fixes that legacy orphan
      // state; updateMany is idempotent (0 rows when nothing is attached).
      await db.$transaction([
        // Detach: bookings become "tanpa PIC" (salesId null) — transferable to
        // another sales via the Booking list. Only touches the sales assignment;
        // manager, snapshots, approvals and payments are untouched.
        db.booking.updateMany({ where: { salesId: profile.id }, data: { salesId: null } }),
        db.profile.update({ where: { id: profile.id }, data: { status: "inactive" } }),
        db.session.deleteMany({ where: { userId: profile.userId } }),
      ]);

      revalidateTag("users", "max");
      if (detachedCount > 0) revalidateTag("bookings", "max");

      // Only audit when something actually changed — a repeat click on an
      // already-inactive account with nothing left to detach is a no-op.
      if (!wasAlreadyInactive || detachedCount > 0) {
        await logAudit({
          userId: session!.user.profileId,
          action: "user.deactivated",
          entityType: "profile",
          entityId: userId,
          description: `Pengguna ${profile.email} dinonaktifkan; ${detachedCount} booking di-detach jadi tanpa PIC`,
          changes: {
            before: { status: profile.status },
            after: { status: "inactive" },
            detachedBookings: detachedCount,
          },
          ipAddress,
          userAgent,
        });
      }

      const bookingNote =
        detachedCount > 0
          ? ` ${detachedCount} booking-nya kini tanpa PIC — transfer ke sales lain lewat menu Booking.`
          : "";
      const base = wasAlreadyInactive
        ? "Pengguna sudah nonaktif sebelumnya."
        : "Sales dinonaktifkan (punya data terkait, tidak bisa dihapus permanen) dan tidak bisa login lagi.";
      return { success: true, message: `${base}${bookingNote}` };
    }
  } catch (error) {
    console.error("[deleteUser] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat menghapus pengguna." };
  }
}

// ─── Reactivate User ──────────────────────────────────────────────────────────

/**
 * Re-enable a soft-deleted (inactive) account so it can log in again.
 * The reverse of deleteUser's soft-delete branch. Bookings that were detached
 * when the account was deactivated are NOT reclaimed — they stay "tanpa PIC"
 * (they may have already been transferred to another sales), so reassigning is a
 * separate, deliberate step via the Booking list.
 */
export async function reactivateUser(userId: string) {
  const { session, error: permError } = await requirePermission({ module: "settings-users", action: "edit" });
  if (permError) return { success: false, error: permError };
  if (!mutationLimiter.check(`user-reactivate:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });
    if (!profile) return { success: false, error: "Pengguna tidak ditemukan." };
    if (profile.status === "active") {
      return { success: true, message: "Pengguna sudah aktif." };
    }

    await db.profile.update({ where: { id: userId }, data: { status: "active" } });

    revalidateTag("users", "max");

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "user.reactivated",
      entityType: "profile",
      entityId: userId,
      description: `Pengguna ${profile.email} diaktifkan kembali`,
      changes: { before: { status: profile.status }, after: { status: "active" } },
      ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, message: "Pengguna diaktifkan kembali dan bisa login lagi." };
  } catch (error) {
    console.error("[reactivateUser] Error:", error);
    return { success: false, error: "Terjadi kesalahan saat mengaktifkan pengguna." };
  }
}

// ─── Resend Invitation ────────────────────────────────────────────────────────

export async function resendInvitation(userId: string) {
  const { session, error } = await requirePermission({ module: "settings-users", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`resend-invite:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const profile = await db.profile.findUnique({ where: { id: userId } });
    if (!profile) {
      return { success: false, error: "Pengguna tidak ditemukan." };
    }

    if (profile.isEmailVerified) {
      return { success: false, error: "Email pengguna sudah diverifikasi." };
    }

    // Fetch active tokens, then invalidate them + create new token in one atomic transaction
    const existingTokens = await db.emailVerificationToken.findMany({
      where: { profileId: userId, usedAt: null },
      select: { id: true },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    const now = new Date();

    await db.$transaction([
      ...existingTokens.map((t) =>
        db.emailVerificationToken.update({ where: { id: t.id }, data: { usedAt: now } })
      ),
      db.emailVerificationToken.create({
        data: { profileId: userId, token, expiresAt },
      }),
    ]);

    // Send invitation email
    const baseUrl = await getBaseUrl();
    const verificationLink = `${baseUrl}/auth/verify?token=${token}`;

    await getResendClient().emails.send({
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
  dataScope?: "own" | "group" | "all";
  groupIds?: string[];
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  const { session, error } = await requirePermission({ module: "settings-users", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`bulk-update-users:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const { userIds, roleId, dataScope, groupIds } = data;
  if (!userIds.length) return { success: false, error: "Tidak ada user yang dipilih." };

  try {
    const profiles = await db.profile.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    });

    await db.$transaction(
      userIds.map((userId) =>
        db.profile.update({
          where: { userId },
          data: {
            ...(roleId && { roleId }),
            ...(dataScope && { dataScope }),
          },
        })
      )
    );

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
      changes: { roleId, dataScope, groupIds, count: userIds.length },
      description: `Bulk updated ${userIds.length} users`,
    });

    revalidateTag("users", "max");
    return { success: true, updated: userIds.length };
  } catch {
    return { success: false, error: "Gagal mengupdate users." };
  }
}
