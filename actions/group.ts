"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { createGroupSchema, updateGroupSchema } from "@/lib/validations/user";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { headers } from "next/headers";

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(data: unknown) {
  const permResult = await requirePermission({ module: "settings", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const group = await db.$transaction(async (tx) => {
      const lastGroup = await tx.userGroup.findFirst({ orderBy: { sortOrder: "desc" } });
      return tx.userGroup.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          leaderId: parsed.data.leaderId || null,
          createdBy: session.user.id,
          sortOrder: (lastGroup?.sortOrder ?? 0) + 1,
        },
      });
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
  } catch (e) {
    console.error("[createGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Group ─────────────────────────────────────────────────────────────

export async function updateGroup(data: unknown) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateGroupSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, name, description, leaderId } = parsed.data;

  try {
    const [group] = await db.$transaction([db.userGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(leaderId !== undefined && { leaderId: leaderId || null }),
      },
    })]);

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
  } catch (e) {
    console.error("[updateGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Group ─────────────────────────────────────────────────────────────

export async function deleteGroup(groupId: string) {
  const permResult = await requirePermission({ module: "settings", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const group = await db.userGroup.findUnique({ where: { id: groupId } });
    if (!group) return { success: false, error: "Grup tidak ditemukan." };

    await db.$transaction([db.userGroup.delete({ where: { id: groupId } })]);

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
  } catch (e) {
    console.error("[deleteGroup]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Member ───────────────────────────────────────────────────────────────

export async function addGroupMember(groupId: string, userId: string) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-member-add:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction(async (tx) => {
      const lastMember = await tx.userGroupMember.findFirst({
        where: { groupId },
        orderBy: { sortOrder: "desc" },
      });

      await tx.userGroupMember.create({
        data: {
          groupId,
          userId,
          sortOrder: (lastMember?.sortOrder ?? 0) + 1,
        },
      });
    });

    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[addGroupMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Remove Member ────────────────────────────────────────────────────────────

export async function removeGroupMember(groupId: string, userId: string) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-member-rm:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.userGroupMember.delete({ where: { groupId_userId: { groupId, userId } } })]);
    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[removeGroupMember]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Reorder Groups ───────────────────────────────────────────────────────────

export async function reorderGroups(orderedIds: string[]) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-reorder:${session.user.id}`)) return { success: false, ...rateLimitError() };

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
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`group-member-reorder:${session.user.id}`)) return { success: false, ...rateLimitError() };

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
