"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission, isSuperAdmin } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import {
  createGroupSchema,
  updateGroupSchema,
  setMemberTargetSchema,
  updateGroupLeaderSchema,
} from "@/lib/validations/user";

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const lastGroup = await db.userGroup.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const group = await db.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        leaderId: parsed.data.leaderId ?? null,
        createdBy: session!.user.id,
        sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
      },
    });

    revalidateTag("groups", "max");
    revalidateTag("users", "max");

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.created",
      entityType: "group",
      entityId: group.id,
      description: `Grup "${group.name}" dibuat`,
      changes: { after: { name: group.name } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, group };
  } catch (e) {
    console.error("[createGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Group ─────────────────────────────────────────────────────────────

export async function updateGroup(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, name, description, leaderId } = parsed.data;

  try {
    const [group] = await db.$transaction([
      db.userGroup.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(leaderId !== undefined && { leaderId: leaderId ?? null }),
        },
      }),
    ]);

    revalidateTag("groups", "max");
    revalidateTag("users", "max");

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.updated",
      entityType: "group",
      entityId: id,
      description: `Grup "${group.name}" diperbarui`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, group };
  } catch (e) {
    console.error("[updateGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Group ─────────────────────────────────────────────────────────────

export async function deleteGroup(groupId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const group = await db.userGroup.findUnique({ where: { id: groupId }, select: { name: true } });
    if (!group) return { success: false, error: "Grup tidak ditemukan." };

    await db.$transaction([db.userGroup.delete({ where: { id: groupId } })]);

    revalidateTag("groups", "max");

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.deleted",
      entityType: "group",
      entityId: groupId,
      description: `Grup "${group.name}" dihapus`,
      changes: { before: { name: group.name } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true };
  } catch (e) {
    console.error("[deleteGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: string, profileId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-member-add:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const last = await db.userGroupMember.findFirst({
      where: { groupId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await db.userGroupMember.create({
      data: { groupId, userId: profileId, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.member_added",
      entityType: "UserGroupMember",
      entityId: groupId,
      description: `Member ditambahkan ke grup`,
      changes: { after: { groupId, profileId } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidateTag("users", "max");
    return { success: true };
  } catch (e) {
    console.error("[addGroupMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

export async function removeGroupMember(groupId: string, profileId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-member-rm:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.userGroupMember.delete({ where: { groupId_userId: { groupId, userId: profileId } } }),
    ]);

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.member_removed",
      entityType: "UserGroupMember",
      entityId: groupId,
      description: `Member dihapus dari grup`,
      changes: { before: { groupId, profileId } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidateTag("users", "max");
    return { success: true };
  } catch (e) {
    console.error("[removeGroupMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Reorder Groups ───────────────────────────────────────────────────────────

export async function reorderGroups(orderedIds: string[]) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-reorder:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction(
      orderedIds.map((id, index) => db.userGroup.update({ where: { id }, data: { sortOrder: index + 1 } }))
    );
    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[reorderGroups]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Reorder Members ──────────────────────────────────────────────────────────

export async function reorderGroupMembers(groupId: string, orderedUserIds: string[]) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-member-reorder:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction(
      orderedUserIds.map((userId, index) =>
        db.userGroupMember.update({
          where: { groupId_userId: { groupId, userId } },
          data: { sortOrder: index + 1 },
        })
      )
    );
    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[reorderGroupMembers]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Set Member Target ────────────────────────────────────────────────────────

export async function setMemberTarget(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-target:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = setMemberTargetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { profileId, amount, startDate, endDate } = parsed.data;
  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    await db.$transaction([
      db.userTarget.deleteMany({
        where: {
          profileId,
          type: "sales",
          startDate: { lte: end },
          endDate: { gte: start },
        },
      }),
      db.userTarget.create({
        data: {
          profileId,
          type: "sales",
          amount: BigInt(amount),
          startDate: start,
          endDate: end,
          setById: session!.user.profileId,
        },
      }),
    ]);

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.member_target_set",
      entityType: "UserTarget",
      entityId: profileId,
      description: `Target sales anggota ditetapkan`,
      changes: { after: { profileId, amount, startDate, endDate } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[setMemberTarget]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Group Leader (Super Admin Only) ───────────────────────────────────

export async function updateGroupLeader(groupId: string, leaderId: string) {
  const parsed = updateGroupLeaderSchema.safeParse({ groupId, leaderId });
  if (!parsed.success) return { success: false, error: "Data tidak valid" };

  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const isAdmin = await isSuperAdmin(session.user.roleId);
  if (!isAdmin) return { success: false, error: "Hanya super admin yang bisa mengganti leader." };
  if (!mutationLimiter.check(`groups-leader:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.userGroup.update({ where: { id: groupId }, data: { leaderId } }),
    ]);

    revalidateTag("groups", "max");

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "group.leader_changed",
      entityType: "group",
      entityId: groupId,
      changes: { after: { leaderId } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true };
  } catch (e) {
    console.error("[updateGroupLeader]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

