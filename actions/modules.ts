"use server";

import crypto from "crypto";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccessibleModules, type AccessibleModule } from "@/lib/queries/modules";
import { apiLimiter, mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { createModuleSchema, updateModuleSchema } from "@/lib/validations/module";

/**
 * Result of resolving where a freshly-logged-in user should go.
 * - `redirect`: land straight on `dest` (0 or 1 accessible module, or rate-limited).
 * - `choose`: the user can access >=2 modules — the login form shows an inline
 *   picker modal with these `modules` instead of navigating anywhere.
 */
export type LoginDestination =
  | { kind: "redirect"; dest: string }
  | { kind: "choose"; modules: AccessibleModule[] };

/**
 * Resolve where a freshly-logged-in user should land when there is no explicit
 * callbackUrl. Inline picker if >=2 modules, direct redirect if exactly 1,
 * general home if 0.
 */
export async function resolveLoginDestination(): Promise<LoginDestination> {
  const session = await auth();
  if (!session?.user?.id) return { kind: "redirect", dest: "/" };

  // Rate-limit before any DB work. On limit, fall back to the standalone picker
  // page (a safe authenticated landing) rather than resolving a per-role dest.
  if (!apiLimiter.check(`resolve-dest:${session.user.id}`)) {
    return { kind: "redirect", dest: "/select-module" };
  }

  const modules = await getAccessibleModules(session.user.roleId);
  if (modules.length >= 2) return { kind: "choose", modules };
  if (modules.length === 1) return { kind: "redirect", dest: `/${modules[0].key}/overview` };
  return { kind: "redirect", dest: "/" };
}

// ─── Module registry admin (settings/modules) ───────────────────────────────
// All gated on `settings-role-permission` — same authority as roles. These
// mutate the Module + ModulePermissionMap tables that drive the sidebar
// switcher / login picker. Reads go through lib/queries/modules.ts.

type ModuleActionResult = { success: true } | { success: false; error: string };

/** Build the array-form ops that replace a module's permission-module mappings. */
function mappingOps(moduleId: string, permissionModules: string[]) {
  // Dedupe — the unique index is (moduleId, permissionModule).
  const unique = Array.from(new Set(permissionModules));
  return [
    db.modulePermissionMap.deleteMany({ where: { moduleId } }),
    ...unique.map((permissionModule) =>
      db.modulePermissionMap.create({
        data: { id: crypto.randomUUID(), moduleId, permissionModule },
      }),
    ),
  ];
}

export async function createModule(input: unknown): Promise<ModuleActionResult> {
  const { session, error } = await requirePermission({ module: "settings-role-permission", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`module-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createModuleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { key, name, icon, isActive, permissionModules } = parsed.data;

  try {
    const existing = await db.module.findUnique({ where: { key }, select: { id: true } });
    if (existing) return { success: false, error: `Module dengan key "${key}" sudah ada` };

    const last = await db.module.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const moduleId = crypto.randomUUID();

    await db.$transaction([
      db.module.create({
        data: {
          id: moduleId,
          key,
          name,
          icon: icon ?? null,
          isActive,
          sortOrder: (last?.sortOrder ?? 0) + 10,
        },
      }),
      ...mappingOps(moduleId, permissionModules),
    ]);

    revalidateTag("modules", "max");
    await logAudit({
      action: "module.created",
      entityType: "module",
      entityId: moduleId,
      description: `Module "${name}" (${key}) dibuat`,
      changes: { after: { key, name, isActive, permissionModules } },
    });
    return { success: true };
  } catch (e) {
    console.error("[createModule]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateModule(input: unknown): Promise<ModuleActionResult> {
  const { session, error } = await requirePermission({ module: "settings-role-permission", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`module-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateModuleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { id, name, icon, isActive, permissionModules } = parsed.data;

  try {
    const current = await db.module.findUnique({ where: { id }, select: { key: true } });
    if (!current) return { success: false, error: "Module tidak ditemukan" };

    await db.$transaction([
      db.module.update({
        where: { id },
        data: { name, icon: icon ?? null, isActive },
      }),
      ...mappingOps(id, permissionModules),
    ]);

    revalidateTag("modules", "max");
    await logAudit({
      action: "module.updated",
      entityType: "module",
      entityId: id,
      description: `Module "${name}" (${current.key}) diperbarui`,
      changes: { after: { name, isActive, permissionModules } },
    });
    return { success: true };
  } catch (e) {
    console.error("[updateModule]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteModule(id: string): Promise<ModuleActionResult> {
  const { session, error } = await requirePermission({ module: "settings-role-permission", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`module-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const current = await db.module.findUnique({ where: { id }, select: { key: true, name: true } });
    if (!current) return { success: false, error: "Module tidak ditemukan" };

    // ModulePermissionMap rows cascade on module delete (FK onDelete: Cascade).
    await db.$transaction([db.module.delete({ where: { id } })]);

    revalidateTag("modules", "max");
    await logAudit({
      action: "module.deleted",
      entityType: "module",
      entityId: id,
      description: `Module "${current.name}" (${current.key}) dihapus`,
      changes: { before: { key: current.key, name: current.name } },
    });
    return { success: true };
  } catch (e) {
    console.error("[deleteModule]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function reorderModuleRegistry(orderedIds: string[]): Promise<ModuleActionResult> {
  const { session, error } = await requirePermission({ module: "settings-role-permission", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`module-reorder:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction(
      orderedIds.map((id, i) => db.module.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })),
    );
    revalidateTag("modules", "max");
    return { success: true };
  } catch (e) {
    console.error("[reorderModuleRegistry]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
