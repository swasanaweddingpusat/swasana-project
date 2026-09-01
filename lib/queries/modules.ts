import { db } from "@/lib/db";

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
 * permission-module strings. Resolved with a single batched role-permission
 * query (no per-module N+1); super-admin (isSystemRole) sees every active module.
 */
export async function getAccessibleModules(
  roleId: string | null | undefined,
): Promise<AccessibleModule[]> {
  if (!roleId) return [];

  const [modules, role] = await Promise.all([
    db.module.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        key: true,
        name: true,
        icon: true,
        sortOrder: true,
        permissionMaps: { select: { permissionModule: true } },
      },
    }),
    db.role.findUnique({
      where: { id: roleId },
      select: { isSystemRole: true },
    }),
  ]);

  if (role?.isSystemRole) {
    return modules.map(({ key, name, icon, sortOrder }) => ({ key, name, icon, sortOrder }));
  }

  // Collect every distinct permission-module string this role can "view".
  const permissionModules = new Set(
    (modules.flatMap((m) => m.permissionMaps.map((pm) => pm.permissionModule))),
  );
  if (permissionModules.size === 0) return [];

  const viewable = new Set(
    (
      await db.rolePermission.findMany({
        where: {
          roleId,
          permission: { action: "view", module: { in: [...permissionModules] } },
        },
        select: { permission: { select: { module: true } } },
      })
    ).map((rp) => rp.permission.module),
  );

  return modules
    .filter((m) => m.permissionMaps.some((pm) => viewable.has(pm.permissionModule)))
    .map(({ key, name, icon, sortOrder }) => ({ key, name, icon, sortOrder }));
}
