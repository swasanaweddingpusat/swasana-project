"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/user";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";

export async function createRole(formData: FormData) {
  const permResult = await requirePermission({ module: "settings", action: "create" });
  if (permResult.error) return { error: permResult.error };
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
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
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { error: permResult.error };
  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
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
  const permResult = await requirePermission({ module: "settings", action: "delete" });
  if (permResult.error) return { error: permResult.error };

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

export async function reorderRoles(orderedIds: string[]) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { error: permResult.error };

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.role.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } });
    }
    revalidateTag("roles", "max");
    return { success: true };
  } catch {
    return { error: "Gagal menyimpan urutan role" };
  }
}

export async function renameModule(oldModule: string, newModule: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "edit" });
  if (permResult.error) return { error: permResult.error };

  const trimmed = newModule.trim().toLowerCase().replace(/\s+/g, "_");
  if (!trimmed) return { error: "Nama module tidak boleh kosong" };

  try {
    const perms = await db.permission.findMany({ where: { module: oldModule }, select: { id: true } });
    for (const p of perms) {
      await db.permission.update({ where: { id: p.id }, data: { module: trimmed } });
    }
    revalidateTag("roles", "max");
    return { success: true, newModule: trimmed };
  } catch {
    return { error: "Gagal rename module" };
  }
}

export async function updatePermission(permissionId: string, action: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "edit" });
  if (permResult.error) return { error: permResult.error };

  try {
    const permission = await db.permission.update({
      where: { id: permissionId },
      data: { action: action.trim().toLowerCase() },
    });
    revalidateTag("roles", "max");
    return { success: true, permission };
  } catch {
    return { error: "Gagal mengupdate permission" };
  }
}

export async function reorderModules(moduleOrder: string[]) {
  const permResult = await requirePermission({ module: "role_permission", action: "edit" });
  if (permResult.error) return { error: permResult.error };

  try {
    for (let i = 0; i < moduleOrder.length; i++) {
      await db.permission.updateMany({
        where: { module: moduleOrder[i] },
        data: { moduleSortOrder: i },
      });
    }
    revalidateTag("roles", "max");
    return { success: true };
  } catch {
    return { error: "Gagal menyimpan urutan module" };
  }
}

export async function deletePermission(permissionId: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "delete" });
  if (permResult.error) return { error: permResult.error };

  try {
    await db.permission.delete({ where: { id: permissionId } });
    revalidateTag("roles", "max");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus permission" };
  }
}

export async function deleteModulePermissions(module: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "delete" });
  if (permResult.error) return { error: permResult.error };

  try {
    await db.permission.deleteMany({ where: { module } });
    revalidateTag("roles", "max");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus module permissions" };
  }
}

export async function createPermission(module: string, action: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "create" });
  if (permResult.error) return { error: permResult.error };

  try {
    const permission = await db.permission.create({ data: { module, action } });
    // Auto-assign to Super Admin
    const superAdmin = await db.role.findFirst({ where: { name: { equals: "Super Admin", mode: "insensitive" } } });
    if (superAdmin) {
      await db.rolePermission.create({ data: { roleId: superAdmin.id, permissionId: permission.id } });
    }
    revalidateTag("roles", "max");
    return { success: true, permission };
  } catch {
    return { error: "Permission sudah ada atau gagal dibuat" };
  }
}

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
) {
  const permResult = await requirePermission({ module: "settings", action: "update" });
  if (permResult.error) return { error: permResult.error };

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
