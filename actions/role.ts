"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/user";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";

export async function createRole(formData: FormData) {
  const permResult = await requirePermission({ module: "settings", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`role-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const [role] = await db.$transaction([db.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    })]);

    revalidateTag("roles", "max");
    await logAudit({
      action: "role.created",
      entityType: "role",
      entityId: role.id,
      description: `Role "${role.name}" dibuat`,
      changes: { after: { name: role.name, description: role.description } },
    });
    return { success: true, role };
  } catch (e) {
    console.error("[createRole]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateRole(formData: FormData) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`role-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const [role] = await db.$transaction([db.role.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    })]);

    revalidateTag("roles", "max");
    await logAudit({
      action: "role.updated",
      entityType: "role",
      entityId: role.id,
      description: `Role "${role.name}" diperbarui`,
      changes: { after: { name: role.name, description: role.description } },
    });
    return { success: true, role };
  } catch (e) {
    console.error("[updateRole]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteRole(roleId: string) {
  const permResult = await requirePermission({ module: "settings", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`role-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const role = await db.role.findUnique({ where: { id: roleId } });

    if (!role) {
      return { success: false, error: "Role tidak ditemukan" };
    }

    if (role.name.toLowerCase() === "super admin") {
      return { success: false, error: "Role Super Admin tidak dapat dihapus" };
    }

    await db.$transaction([db.role.delete({ where: { id: roleId } })]);

    revalidateTag("roles", "max");
    await logAudit({
      action: "role.deleted",
      entityType: "role",
      entityId: roleId,
      description: `Role "${role.name}" dihapus`,
      changes: { before: { name: role.name } },
    });
    return { success: true };
  } catch (e) {
    console.error("[deleteRole]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function reorderRoles(orderedIds: string[]) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`role-reorder:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction(
      orderedIds.map((id, i) => db.role.update({ where: { id }, data: { sortOrder: i } }))
    );
    revalidateTag("roles", "max");
    return { success: true };
  } catch (e) {
    console.error("[reorderRoles]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function renameModule(oldModule: string, newModule: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`module-rename:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const trimmed = newModule.trim().toLowerCase().replace(/\s+/g, "_");
  if (!trimmed) return { success: false, error: "Nama module tidak boleh kosong" };

  try {
    await db.$transaction([db.permission.updateMany({ where: { module: oldModule }, data: { module: trimmed } })]);
    revalidateTag("roles", "max");
    return { success: true, newModule: trimmed };
  } catch (e) {
    console.error("[renameModule]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updatePermission(permissionId: string, action: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`perm-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const [permission] = await db.$transaction([db.permission.update({
      where: { id: permissionId },
      data: { action: action.trim().toLowerCase() },
    })]);
    revalidateTag("roles", "max");
    return { success: true, permission };
  } catch (e) {
    console.error("[updatePermission]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function reorderModules(moduleOrder: string[]) {
  const permResult = await requirePermission({ module: "role_permission", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`module-reorder:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction(
      moduleOrder.map((mod, i) => db.permission.updateMany({ where: { module: mod }, data: { moduleSortOrder: i } }))
    );
    revalidateTag("roles", "max");
    return { success: true };
  } catch (e) {
    console.error("[reorderModules]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePermission(permissionId: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`perm-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.permission.delete({ where: { id: permissionId } })]);
    revalidateTag("roles", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePermission]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteModulePermissions(module: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`module-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.permission.deleteMany({ where: { module } })]);
    revalidateTag("roles", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteModulePermissions]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function createPermission(module: string, action: string) {
  const permResult = await requirePermission({ module: "role_permission", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`perm-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const permission = await db.$transaction(async (tx) => {
      const perm = await tx.permission.create({ data: { module, action } });
      // Auto-assign to Super Admin
      const superAdmin = await tx.role.findFirst({ where: { name: { equals: "Super Admin", mode: "insensitive" } } });
      if (superAdmin) {
        await tx.rolePermission.create({ data: { roleId: superAdmin.id, permissionId: perm.id } });
      }
      return perm;
    });
    revalidateTag("roles", "max");
    return { success: true, permission };
  } catch (e) {
    console.error("[createPermission]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
) {
  const permResult = await requirePermission({ module: "settings", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`role-perm:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId } }),
      ...permissionIds.map((permissionId) =>
        db.rolePermission.create({ data: { roleId, permissionId } })
      ),
    ]);

    revalidateTag("roles", "max");
    await logAudit({
      action: "permission.changed",
      entityType: "role",
      entityId: roleId,
      description: `Permission role diperbarui (${permissionIds.length} permission)`,
      changes: { after: { permissionIds } },
    });
    return { success: true };
  } catch (e) {
    console.error("[updateRolePermissions]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
