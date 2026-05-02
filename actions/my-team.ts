"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { setMemberTargetSchema, updateGroupSchema } from "@/lib/validations/user";

// ─── Update Team Settings ─────────────────────────────────────────────────────

export async function updateMyTeamSettings(data: unknown) {
  const permResult = await requirePermission({ module: "booking", action: "view" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`my-team-settings:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, name, description } = parsed.data;

  // Pastikan user adalah leader dari group ini
  const group = await db.userGroup.findUnique({ where: { id }, select: { leaderId: true, name: true } });
  if (!group) return { success: false, error: "Tim tidak ditemukan." };
  if (group.leaderId !== session.user.profileId) return { success: false, error: "Tidak memiliki akses." };

  try {
    const [updated] = await db.$transaction([
      db.userGroup.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
        },
      }),
    ]);

    revalidateTag("my-team", { expire: 0 });
    revalidateTag("groups", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "my-team.settings_updated",
      entityType: "group",
      entityId: id,
      description: `Pengaturan tim "${updated.name}" diperbarui`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true };
  } catch (e) {
    console.error("[updateMyTeamSettings]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

export async function addMyTeamMember(groupId: string, profileId: string) {
  const permResult = await requirePermission({ module: "booking", action: "view" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`my-team-add:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const group = await db.userGroup.findUnique({ where: { id: groupId }, select: { leaderId: true } });
  if (!group) return { success: false, error: "Tim tidak ditemukan." };
  if (group.leaderId !== session.user.profileId) return { success: false, error: "Tidak memiliki akses." };

  try {
    await db.$transaction(async (tx) => {
      const last = await tx.userGroupMember.findFirst({
        where: { groupId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await tx.userGroupMember.create({
        data: { groupId, userId: profileId, sortOrder: (last?.sortOrder ?? 0) + 1 },
      });
    });

    revalidateTag("my-team", { expire: 0 });
    revalidateTag("groups", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[addMyTeamMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

export async function removeMyTeamMember(groupId: string, profileId: string) {
  const permResult = await requirePermission({ module: "booking", action: "view" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`my-team-rm:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const group = await db.userGroup.findUnique({ where: { id: groupId }, select: { leaderId: true } });
  if (!group) return { success: false, error: "Tim tidak ditemukan." };
  if (group.leaderId !== session.user.profileId) return { success: false, error: "Tidak memiliki akses." };

  try {
    await db.$transaction([
      db.userGroupMember.delete({
        where: { groupId_userId: { groupId, userId: profileId } },
      }),
    ]);

    revalidateTag("my-team", { expire: 0 });
    revalidateTag("groups", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[removeMyTeamMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Set Member Target ────────────────────────────────────────────────────────

export async function setMemberTarget(data: unknown) {
  const permResult = await requirePermission({ module: "booking", action: "view" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`my-team-target:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = setMemberTargetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { groupId, profileId, amount, startDate, endDate } = parsed.data;

  const group = await db.userGroup.findUnique({ where: { id: groupId }, select: { leaderId: true } });
  if (!group) return { success: false, error: "Tim tidak ditemukan." };
  if (group.leaderId !== session.user.profileId) return { success: false, error: "Tidak memiliki akses." };

  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    await db.$transaction(async (tx) => {
      // Upsert: hapus target lama yang overlap, buat yang baru
      await tx.userTarget.deleteMany({
        where: {
          profileId,
          type: "sales",
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      await tx.userTarget.create({
        data: {
          profileId,
          type: "sales",
          amount: BigInt(amount),
          startDate: start,
          endDate: end,
          setById: session.user.profileId,
        },
      });
    });

    revalidateTag("my-team", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[setMemberTarget]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Approve Booking ──────────────────────────────────────────────────────────

export async function approveBooking(bookingId: string, signature: string) {
  const permResult = await requirePermission({ module: "booking", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`booking-approve:${session.user.id}`)) return { success: false, ...rateLimitError() };

  if (!signature) return { success: false, error: "Tanda tangan wajib diisi." };

  try {
    const [booking] = await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: {
          managerId: session.user.profileId,
          managerApprovedAt: new Date(),
          managerSignature: signature,
        },
      }),
    ]);

    revalidateTag("my-team", { expire: 0 });
    revalidateTag("bookings", { expire: 0 });

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "booking.approved",
      entityType: "booking",
      entityId: bookingId,
      description: `Booking disetujui oleh manager`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, booking };
  } catch (e) {
    console.error("[approveBooking]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
