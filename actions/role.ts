"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/user";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";

export async function createRole(formData: FormData) {
  const { error: authError } = await requirePermission({ module: "settings", action: "create" });
  if (authError) return { error: authError };
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const role = await db.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    revalidateTag("roles", "max");
    await logAudit({
      action: "role.created",
      entityType: "role",
      entityId: role.id,
      description: `Role "${role.name}" dibuat`,
      changes: { after: { name: role.name, description: role.description } },
    });
    return { success: true, role };
  } catch (error) {
    console.error("createRole error:", error);
    return { error: "Gagal membuat role" };
  }
}

export async function updateRole(formData: FormData) {
  const { error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { error: authError };
  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const role = await db.role.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    revalidateTag("roles", "max");
    await logAudit({
      action: "role.updated",
      entityType: "role",
      entityId: role.id,
      description: `Role "${role.name}" diperbarui`,
      changes: { after: { name: role.name, description: role.description } },
    });
    return { success: true, role };
  } catch (error) {
    console.error("updateRole error:", error);
    return { error: "Gagal mengupdate role" };
  }
}

export async function deleteRole(roleId: string) {
  const { error: authError } = await requirePermission({ module: "settings", action: "delete" });
  if (authError) return { error: authError };

  try {
    const role = await db.role.findUnique({ where: { id: roleId } });

    if (!role) {
      return { error: "Role tidak ditemukan" };
    }

    if (role.name.toLowerCase() === "super admin") {
      return { error: "Role Super Admin tidak dapat dihapus" };
    }

    await db.role.delete({ where: { id: roleId } });

    revalidateTag("roles", "max");
    await logAudit({
      action: "role.deleted",
      entityType: "role",
      entityId: roleId,
      description: `Role "${role.name}" dihapus`,
      changes: { before: { name: role.name } },
    });
    return { success: true };
  } catch (error) {
    console.error("deleteRole error:", error);
    return { error: "Gagal menghapus role" };
  }
}

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
) {
  const { error: authError } = await requirePermission({ module: "settings", action: "update" });
  if (authError) return { error: authError };

  try {
    // Delete all existing, then insert new ones atomically via array transaction
    await db.rolePermission.deleteMany({ where: { roleId } });

    if (permissionIds.length > 0) {
      for (const permissionId of permissionIds) {
        await db.rolePermission.create({ data: { roleId, permissionId } });
      }
    }

    revalidateTag("roles", "max");
    await logAudit({
      action: "permission.changed",
      entityType: "role",
      entityId: roleId,
      description: `Permission role diperbarui (${permissionIds.length} permission)`,
      changes: { after: { permissionIds } },
    });
    return { success: true };
  } catch (error) {
    console.error("updateRolePermissions error:", error);
    return { error: "Gagal mengupdate permissions role" };
  }
}
