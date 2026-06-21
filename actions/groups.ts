"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission, isSuperAdmin } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";
import {
  createGroupSchema,
  updateGroupSchema,
  setMemberTargetSchema,
  deleteMemberTargetSchema,
  updateGroupLeaderSchema,
} from "@/lib/validations/group";

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const newLeaderId = parsed.data.leaderId ?? null;

  try {
    const lastGroup = await db.userGroup.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });

    // Create group first. We use a separate step for leader membership because
    // the array-form transaction cannot pass the new group.id to sibling ops.
    const group = await db.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        leaderId: newLeaderId,
        createdBy: session!.user.id,
        sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
      },
    });

    // If leader is set, ensure they are a member and have dataScope = "group"
    if (newLeaderId) {
      // New group — leader can never be a member yet, so always create membership.
      const leaderOps: Prisma.PrismaPromise<unknown>[] = [
        db.userGroupMember.create({
          data: { groupId: group.id, userId: newLeaderId, sortOrder: 1 },
        }),
        db.profile.update({
          where: { id: newLeaderId },
          data: { dataScope: "group" },
        }),
      ];
      await db.$transaction(leaderOps);
    }

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.created",
      entityType: "group",
      entityId: group.id,
      description: `Grup "${group.name}" dibuat`,
      changes: { after: { name: group.name, leaderId: newLeaderId } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidateTag("users", "max");

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
    // ── Phase 1: Reads (before any write) ──
    const currentGroup = await db.userGroup.findUnique({
      where: { id },
      select: { name: true, leaderId: true },
    });
    if (!currentGroup) return { success: false, error: "Grup tidak ditemukan." };

    const oldLeaderId = currentGroup.leaderId;
    const newLeaderId = leaderId !== undefined ? (leaderId ?? null) : oldLeaderId;
    const leaderChanging = leaderId !== undefined && newLeaderId !== oldLeaderId;

    // Conditionally read membership state for the new leader (needed to build tx ops)
    let existingMember: { userId: string } | null = null;
    let lastMemberSortOrder = 0;
    if (leaderChanging && newLeaderId) {
      existingMember = await db.userGroupMember.findUnique({
        where: { groupId_userId: { groupId: id, userId: newLeaderId } },
        select: { userId: true },
      });
      if (!existingMember) {
        const lastMember = await db.userGroupMember.findFirst({
          where: { groupId: id },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        lastMemberSortOrder = lastMember?.sortOrder ?? 0;
      }
    }

    // ── Phase 2: Build all write ops ──
    const groupUpdateOp = db.userGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(leaderId !== undefined && { leaderId: newLeaderId }),
      },
    });

    const sideOps: Prisma.PrismaPromise<unknown>[] = [];

    if (leaderChanging) {
      // New leader: ensure membership + set dataScope "group"
      if (newLeaderId && !existingMember) {
        sideOps.push(
          db.userGroupMember.create({
            data: { groupId: id, userId: newLeaderId, sortOrder: lastMemberSortOrder + 1 },
          })
        );
      }
      if (newLeaderId) {
        sideOps.push(
          db.profile.update({
            where: { id: newLeaderId },
            data: { dataScope: "group" },
          })
        );
      }
      // Old leader: keep membership, reset dataScope to "own"
      if (oldLeaderId) {
        sideOps.push(
          db.profile.update({
            where: { id: oldLeaderId },
            data: { dataScope: "own" },
          })
        );
      }
    }

    // ── Phase 3: Single atomic transaction ──
    const [group] = await db.$transaction([groupUpdateOp, ...sideOps]);

    const groupName = name ?? currentGroup.name;

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.updated",
      entityType: "group",
      entityId: id,
      description: `Grup "${groupName}" diperbarui`,
      changes: {
        ...(leaderChanging && {
          before: { leaderId: oldLeaderId },
          after: { leaderId: newLeaderId },
        }),
      },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidateTag("users", "max");
    revalidatePath(`/dashboard/groups/${id}`);
    revalidatePath("/dashboard/groups");

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

    revalidateTag("groups", "max");

    return { success: true };
  } catch (e) {
    console.error("[deleteGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: string, profileId: string) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-member-add:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const last = await db.userGroupMember.findFirst({
      where: { groupId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const h = await headers();
    await db.$transaction([
      db.userGroupMember.create({
        data: { groupId, userId: profileId, sortOrder: (last?.sortOrder ?? 0) + 1 },
      }),
    ]);

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
    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath("/dashboard/groups");
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
    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath("/dashboard/groups");
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

  const { groupId, profileId, year, amount } = parsed.data;

  try {
    await db.userTarget.upsert({
      where: {
        profileId_type_year: { profileId, type: "sales", year },
      },
      create: {
        profileId,
        type: "sales",
        year,
        amount: BigInt(amount),
        setById: session!.user.profileId,
      },
      update: {
        amount: BigInt(amount),
        setById: session!.user.profileId,
      },
    });

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.member_target_set",
      entityType: "UserTarget",
      entityId: profileId,
      description: `Target sales ${year} anggota ditetapkan`,
      changes: { after: { profileId, year, amount } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath("/dashboard/groups");
    return { success: true };
  } catch (e) {
    console.error("[setMemberTarget]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Member Target ─────────────────────────────────────────────────────

export async function deleteMemberTarget(data: unknown) {
  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-target-del:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = deleteMemberTargetSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { groupId, profileId, year } = parsed.data;

  try {
    await db.$transaction([
      db.userTarget.deleteMany({
        where: { profileId, type: "sales", year },
      }),
    ]);

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.member_target_deleted",
      entityType: "UserTarget",
      entityId: profileId,
      description: `Target sales ${year} anggota dihapus`,
      changes: { before: { profileId, year } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath("/dashboard/groups");
    return { success: true };
  } catch (e) {
    console.error("[deleteMemberTarget]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Group Leader (Super Admin Only) ───────────────────────────────────

export async function updateGroupLeader(groupId: string, leaderId: string) {
  const parsed = updateGroupLeaderSchema.safeParse({ groupId, leaderId });
  if (!parsed.success) return { success: false, error: "Data tidak valid" };

  const { session, error } = await requirePermission({ module: "groups", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`groups-leader:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const isAdmin = await isSuperAdmin(session!.user.roleId);
  if (!isAdmin) return { success: false, error: "Hanya super admin yang bisa mengganti leader." };

  try {
    // Read current group to know the old leader
    const currentGroup = await db.userGroup.findUnique({
      where: { id: groupId },
      select: { leaderId: true },
    });
    if (!currentGroup) return { success: false, error: "Grup tidak ditemukan." };

    const oldLeaderId = currentGroup.leaderId;
    const newLeaderId = leaderId; // updateGroupLeaderSchema guarantees non-empty string

    // No-op if same leader
    if (oldLeaderId === newLeaderId) {
      return { success: true };
    }

    // Check if new leader is already a member
    const existingMember = newLeaderId
      ? await db.userGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId: newLeaderId } },
          select: { userId: true },
        })
      : null;

    const lastMember = newLeaderId && !existingMember
      ? await db.userGroupMember.findFirst({
          where: { groupId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        })
      : null;

    const txOps: Prisma.PrismaPromise<unknown>[] = [
      db.userGroup.update({ where: { id: groupId }, data: { leaderId: newLeaderId } }),
    ];

    // New leader: ensure membership + set dataScope "group"
    if (newLeaderId && !existingMember) {
      txOps.push(
        db.userGroupMember.create({
          data: { groupId, userId: newLeaderId, sortOrder: (lastMember?.sortOrder ?? 0) + 1 },
        })
      );
    }
    if (newLeaderId) {
      txOps.push(
        db.profile.update({
          where: { id: newLeaderId },
          data: { dataScope: "group" },
        })
      );
    }

    // Old leader: keep membership, reset dataScope to "own"
    if (oldLeaderId) {
      txOps.push(
        db.profile.update({
          where: { id: oldLeaderId },
          data: { dataScope: "own" },
        })
      );
    }

    await db.$transaction(txOps);

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "group.leader_changed",
      entityType: "group",
      entityId: groupId,
      changes: { before: { leaderId: oldLeaderId }, after: { leaderId: newLeaderId } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("groups", "max");
    revalidateTag("users", "max");
    revalidatePath(`/dashboard/groups/${groupId}`);
    revalidatePath("/dashboard/groups");

    return { success: true };
  } catch (e) {
    console.error("[updateGroupLeader]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

