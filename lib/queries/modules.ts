import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export interface AccessibleModule {
  key: string;
  name: string;
  icon: string | null;
  sortOrder: number;
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
