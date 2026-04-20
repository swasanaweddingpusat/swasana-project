"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { createGroupSchema, updateGroupSchema } from "@/lib/validations/user";
import { headers } from "next/headers";

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(data: unknown) {
  const permResult = await requirePermission({ module: "settings", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const lastGroup = await db.userGroup.findFirst({ orderBy: { sortOrder: "desc" } });
    const group = await db.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        leaderId: parsed.data.leaderId || null,
        createdBy: session.user.id,
        sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
      },
    });

    revalidateTag("groups", "max");

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "group.created",
      entityType: "group",
      entityId: group.id,
      description: `Grup "${group.name}" dibuat`,
      changes: { after: { name: group.name } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, group };
  } catch {
    return { success: false, error: "Gagal membuat grup." };
  }
}

// ─── Update Group ─────────────────────────────────────────────────────────────

export async function updateGroup(data: unknown) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;

  const parsed = updateGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, name, description, leaderId } = parsed.data;

  try {
    const group = await db.userGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(leaderId !== undefined && { leaderId: leaderId || null }),
      },
    });

    revalidateTag("groups", "max");

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "group.updated",
      entityType: "group",
      entityId: id,
      description: `Grup "${group.name}" diperbarui`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, group };
  } catch {
    return { success: false, error: "Gagal memperbarui grup." };
  }
}

// ─── Delete Group ─────────────────────────────────────────────────────────────

export async function deleteGroup(groupId: string) {
  const permResult = await requirePermission({ module: "settings", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;

  try {
    const group = await db.userGroup.findUnique({ where: { id: groupId } });
    if (!group) return { success: false, error: "Grup tidak ditemukan." };

    await db.userGroup.delete({ where: { id: groupId } });

    revalidateTag("groups", "max");

    const h = await headers();
    await logAudit({
      userId: session.user.profileId,
      action: "group.deleted",
      entityType: "group",
      entityId: groupId,
      description: `Grup "${group.name}" dihapus`,
      changes: { before: { name: group.name } },
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus grup." };
  }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: string, userId: string) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { success: false, error: permResult.error };

  try {
    const lastMember = await db.userGroupMember.findFirst({
      where: { groupId },
      orderBy: { sortOrder: "desc" },
    });

    await db.userGroupMember.create({
      data: {
        groupId,
        userId,
        sortOrder: (lastMember?.sortOrder ?? 0) + 1,
      },
    });

    revalidateTag("groups", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menambahkan anggota." };
  }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

export async function removeGroupMember(groupId: string, userId: string) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { success: false, error: permResult.error };

  try {
    await db.userGroupMember.delete({ where: { groupId_userId: { groupId, userId } } });
    revalidateTag("groups", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus anggota." };
  }
}

// ─── Reorder Groups ───────────────────────────────────────────────────────────

export async function reorderGroups(orderedIds: string[]) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { success: false, error: permResult.error };

  try {
    for (let index = 0; index < orderedIds.length; index++) {
      await db.userGroup.update({ where: { id: orderedIds[index] }, data: { sortOrder: index + 1 } });
    }
    revalidateTag("groups", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan urutan grup." };
  }
}

// ─── Reorder Members ──────────────────────────────────────────────────────────

export async function reorderGroupMembers(groupId: string, orderedUserIds: string[]) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { success: false, error: permResult.error };

  try {
    for (let index = 0; index < orderedUserIds.length; index++) {
      await db.userGroupMember.update({
        where: { groupId_userId: { groupId, userId: orderedUserIds[index] } },
        data: { sortOrder: index + 1 },
      });
    }
    revalidateTag("groups", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan urutan anggota." };
  }
}
