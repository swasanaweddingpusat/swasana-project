import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export interface AccessibleModule {
  key: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}

export interface ModuleAdminItem {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  permissionModules: string[];
}

/**
 * Full module registry for the admin settings page — every module (active AND
 * inactive) with its mapped permission-module strings. Unlike
 * getAccessibleModules() this does NOT filter by the caller's permissions; the
 * page itself is gated on `settings-role-permission`.
 */
export async function getAllModules(): Promise<ModuleAdminItem[]> {
  const modules = await db.module.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      icon: true,
      sortOrder: true,
      isActive: true,
      permissionMaps: { select: { permissionModule: true } },
    },
  });

  return modules.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    icon: m.icon,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    permissionModules: m.permissionMaps.map((pm) => pm.permissionModule),
  }));
}

/**
 * Distinct permission-module strings that exist in the permission catalog —
 * used to populate the mapping multiselect on the module admin page.
 */
export async function getPermissionModules(): Promise<string[]> {
  const rows = await db.permission.findMany({
    distinct: ["module"],
    orderBy: { module: "asc" },
    select: { module: true },
  });
  return rows.map((r) => r.module);
}

/**
 * Returns active modules the given role can see in the sidebar switcher / picker.
 * A module is accessible if the role has `view` on at least one of its mapped
 * permission-module strings. Reuses the existing permission system — no new
 * permission code path.
 */
export async function getAccessibleModules(
  roleId: string | null | undefined,
): Promise<AccessibleModule[]> {
  if (!roleId) return [];

  const modules = await db.module.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      key: true,
      name: true,
      icon: true,
      sortOrder: true,
      permissionMaps: { select: { permissionModule: true } },
    },
  });

  const accessible: AccessibleModule[] = [];
  for (const m of modules) {
    const checks = await Promise.all(
      m.permissionMaps.map((pm) => hasPermission(roleId, pm.permissionModule, "view")),
    );
    if (checks.some(Boolean)) {
      accessible.push({ key: m.key, name: m.name, icon: m.icon, sortOrder: m.sortOrder });
    }
  }
  return accessible;
}
