"use server";

import crypto from "crypto";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { createModuleSchema, updateModuleSchema } from "@/lib/validations/module";

/**
 * Result of resolving where a freshly-logged-in user should go.
 * Always the general overview at `/` — there is no per-module landing or picker
 * anymore. Kept as a small seam in case per-role landing is reintroduced later.
 */
export type LoginDestination = { kind: "redirect"; dest: string };

/**
 * Resolve where a freshly-logged-in user should land when there is no explicit
 * callbackUrl. Always the general overview `/` — the module picker and the
 * per-module overview pages have been retired.
 */
export async function resolveLoginDestination(): Promise<LoginDestination> {
  return { kind: "redirect", dest: "/" };
}

// ─── Module registry admin (settings/modules) ───────────────────────────────
// All gated on `settings-role-permission` — same authority as roles. These
// mutate the Module + ModulePermissionMap tables that drive the sidebar
// module-switcher. Reads go through lib/queries/modules.ts.

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
