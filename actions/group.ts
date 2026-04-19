"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { createGroupSchema, updateGroupSchema } from "@/lib/validations/user";
import { headers } from "next/headers";

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(data: unknown) {
  const { session, error: authError } = await requirePermission({ module: "settings", action: "create" });
  if (authError) return { success: false, error: authError };

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const lastGroup = await db.userDataGroup.findFirst({ orderBy: { sortOrder: "desc" } });
    const group = await db.userDataGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        leaderId: parsed.data.leaderId || null,
        createdBy: session.user.id,
        sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
      },
    });

    revalidateTag("groups");

    const h = await headers();
    await logAudit({
      userId: session.user.id,
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
  const { session, error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { success: false, error: authError };

  const parsed = updateGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { id, name, description, leaderId } = parsed.data;

  try {
    const group = await db.userDataGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(leaderId !== undefined && { leaderId: leaderId || null }),
      },
    });

    revalidateTag("groups");

    const h = await headers();
    await logAudit({
      userId: session.user.id,
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
  const { session, error: authError } = await requirePermission({ module: "settings", action: "delete" });
  if (authError) return { success: false, error: authError };

  try {
    const group = await db.userDataGroup.findUnique({ where: { id: groupId } });
    if (!group) return { success: false, error: "Grup tidak ditemukan." };

    await db.userDataGroup.delete({ where: { id: groupId } });

    revalidateTag("groups");

    const h = await headers();
    await logAudit({
      userId: session.user.id,
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
  const { error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { success: false, error: authError };

  try {
    const lastMember = await db.userDataGroupMember.findFirst({
      where: { groupId },
      orderBy: { sortOrder: "desc" },
    });

    await db.userDataGroupMember.create({
      data: {
        groupId,
        userId,
        sortOrder: (lastMember?.sortOrder ?? 0) + 1,
      },
    });

    revalidateTag("groups");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menambahkan anggota." };
  }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

export async function removeGroupMember(groupId: string, userId: string) {
  const { error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { success: false, error: authError };

  try {
    await db.userDataGroupMember.delete({ where: { groupId_userId: { groupId, userId } } });
    revalidateTag("groups");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus anggota." };
  }
}

// ─── Reorder Groups ───────────────────────────────────────────────────────────

export async function reorderGroups(orderedIds: string[]) {
  const { error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { success: false, error: authError };

  try {
    await db.$transaction(
      orderedIds.map((id, index) =>
        db.userDataGroup.update({ where: { id }, data: { sortOrder: index + 1 } })
      )
    );
    revalidateTag("groups");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan urutan grup." };
  }
}

// ─── Reorder Members ──────────────────────────────────────────────────────────

export async function reorderGroupMembers(groupId: string, orderedUserIds: string[]) {
  const { error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { success: false, error: authError };

  try {
    await db.$transaction(
      orderedUserIds.map((userId, index) =>
        db.userDataGroupMember.update({
          where: { groupId_userId: { groupId, userId } },
          data: { sortOrder: index + 1 },
        })
      )
    );
    revalidateTag("groups");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan urutan anggota." };
  }
}
