"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { resolveApprovalSteps } from "@/lib/approval-flows";
import { createNotifications } from "@/lib/notifications";
import {
  createPackageSchema,
  updatePackageSchema,
  createVendorItemSchema,
  createInternalItemSchema,
  miceItemSchema,
} from "@/lib/validations/package";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PkgCategory = "WEDDINGS" | "MICE";

function permModuleFor(category: PkgCategory): "package" | "package-mice" {
  return category === "MICE" ? "package-mice" : "package";
}

// ─── Package CRUD ────────────────────────────────────────────────────────────

export async function getPackageCreatedBy(packageId: string): Promise<string | null> {
  try {
    const pkg = await db.package.findUnique({ where: { id: packageId }, select: { category: true } });
    const mod = pkg ? permModuleFor(pkg.category as PkgCategory) : "package";
    const record = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: mod, entityId: packageId } },
      select: { createdBy: { select: { fullName: true } } },
    });
    return record?.createdBy?.fullName ?? null;
  } catch (e) {
    console.error("[getPackageCreatedBy]", e);
    return null;
  }
}

export async function createPackage(data: unknown): Promise<
  { success: true; data: { id: string; packageName: string } } | { success: false; error: string }
> {
  const parsed = createPackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const category = parsed.data.category as PkgCategory;
  const mod = permModuleFor(category);

  const { session, error } = await requirePermission({ module: mod, action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pkg-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const { signature, ...pkgData } = parsed.data;

    const steps = await resolveApprovalSteps(mod);

    const packageId = crypto.randomUUID();
    const recordId = crypto.randomUUID();
    const now = new Date();
    const creatorRoleId = session!.user.roleId;
    const creatorStepIdx = steps
      ? steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === creatorRoleId)
      : -1;
    // allAutoApproved: only when flow has exactly 1 step and creator matches that step
    const allAutoApproved =
      steps !== null &&
      steps.length > 0 &&
      steps.every((_, i) => i === creatorStepIdx);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.package.create({ data: { id: packageId, ...pkgData, approvalStatus: "pending" } }),
      ...(steps && steps.length > 0
        ? [
            db.approvalRecord.create({
              data: {
                id: recordId,
                module: mod,
                entityId: packageId,
                status: "pending",
                createdById: session!.user.profileId!,
              },
            }),
            ...steps.map((step, i) => {
              // Auto-approve ONLY the step whose approverRoleId matches the creator's role.
              const shouldAutoApprove = creatorStepIdx >= 0 && i === creatorStepIdx;
              return db.approvalRecordStep.create({
                data: {
                  recordId,
                  stepOrder: step.sortOrder,
                  approverType: step.approverType,
                  approverRoleId: step.approverRoleId,
                  approverUserId: null,
                  status: shouldAutoApprove ? "approved" : "pending",
                  decidedById: shouldAutoApprove ? session!.user.profileId! : null,
                  decidedAt: shouldAutoApprove ? now : null,
                  signature: shouldAutoApprove ? (signature ?? null) : null,
                },
              });
            }),
            ...(allAutoApproved
              ? [
                  db.approvalRecord.update({
                    where: { id: recordId },
                    data: { status: "approved" },
                  }),
                  db.package.update({
                    where: { id: packageId },
                    data: { approvalStatus: "approved" },
                  }),
                ]
              : []),
          ]
        : []),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "packages.create",
      entityType: mod,
      entityId: packageId,
      description: `Created package "${pkgData.packageName}"`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id: packageId, packageName: pkgData.packageName } };
  } catch (e) {
    console.error("[createPackage]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updatePackage(id: string, data: unknown): Promise<
  { success: true; data: { id: string } } | { success: false; error: string }
> {
  const parsed = updatePackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  // Strip category — editing must never flip a package between wedding/mice
  const { signature, category: _ignoredCategory, ...pkgData } = parsed.data;

  // Detect pax change (triggers approval reset) + fetch category for permission module
  const existing = await db.package.findUnique({ where: { id }, select: { pax: true, approvalStatus: true, category: true } });
  const paxChanged = pkgData.pax !== undefined && existing?.pax !== pkgData.pax;
  const mod = permModuleFor((existing?.category ?? "WEDDINGS") as PkgCategory);

  const { session, error } = await requirePermission({ module: mod, action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pkg-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  // Read-only queries before transaction
  const [steps, existingApproval] = await Promise.all([
    resolveApprovalSteps(mod),
    db.approvalRecord.findUnique({
      where: { module_entityId: { module: mod, entityId: id } },
      select: { id: true },
    }),
  ]);

  try {
    const recordId = existingApproval?.id ?? crypto.randomUUID();
    const now = new Date();
    const creatorRoleId = session!.user.roleId;
    const creatorStepIdx = steps
      ? steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === creatorRoleId)
      : -1;
    // allAutoApproved: only when flow has exactly 1 step and creator matches that step
    const allAutoApproved =
      steps !== null &&
      steps.length > 0 &&
      steps.every((_, i) => i === creatorStepIdx);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.package.update({ where: { id }, data: { ...pkgData, approvalStatus: "pending" } }),
      ...(steps && steps.length > 0
        ? [
            db.approvalRecordStep.deleteMany({ where: { recordId } }),
            existingApproval
              ? db.approvalRecord.update({
                  where: { id: existingApproval.id },
                  data: {
                    status: "pending",
                    updatedById: session!.user.profileId!,
                  },
                })
              : db.approvalRecord.create({
                  data: {
                    id: recordId,
                    module: mod,
                    entityId: id,
                    status: "pending",
                    createdById: session!.user.profileId!,
                  },
                }),
            ...steps.map((step, i) => {
              // Auto-approve ONLY the step whose approverRoleId matches the editor's role.
              const shouldAutoApprove = creatorStepIdx >= 0 && i === creatorStepIdx;
              return db.approvalRecordStep.create({
                data: {
                  recordId,
                  stepOrder: step.sortOrder,
                  approverType: step.approverType,
                  approverRoleId: step.approverRoleId,
                  approverUserId: null,
                  status: shouldAutoApprove ? "approved" : "pending",
                  decidedById: shouldAutoApprove ? session!.user.profileId! : null,
                  decidedAt: shouldAutoApprove ? now : null,
                  signature: shouldAutoApprove ? (signature ?? null) : null,
                },
              });
            }),
            ...(allAutoApproved
              ? [
                  db.approvalRecord.update({
                    where: { id: recordId },
                    data: { status: "approved" },
                  }),
                  db.package.update({
                    where: { id },
                    data: { approvalStatus: "approved" },
                  }),
                ]
              : []),
          ]
        : []),
    ];

    await db.$transaction(ops);

    if (paxChanged) {
      await logAudit({
        userId: session!.user.id,
        action: "package.approval_reset",
        entityType: mod,
        entityId: id,
        description: `Approval reset: pax berubah pada package`,
      });
    }

    await logAudit({
      userId: session!.user.id,
      action: "packages.update",
      entityType: mod,
      entityId: id,
      description: `Updated package`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[updatePackage]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function duplicatePackage(id: string): Promise<
  { success: true; data: { id: string; packageName: string } } | { success: false; error: string }
> {
  try {
    const source = await db.package.findUnique({
      where: { id },
      select: {
        packageName: true,
        category: true,
        venueId: true,
        notes: true,
        pax: true,
        margin: true,
        sellingPrice: true,
        termAndCondition: true,
        categoryPrices: { select: { categoryId: true, categoryName: true, basePrice: true, sortOrder: true, isShow: true } },
        vendorItems: { select: { categoryId: true, categoryName: true, itemText: true, sortOrder: true } },
        internalItems: { select: { itemName: true, itemDescription: true, sortOrder: true } },
      },
    });
    if (!source) return { success: false, error: "Package tidak ditemukan." };

    const mod = permModuleFor(source.category as PkgCategory);
    const { session, error } = await requirePermission({ module: mod, action: "create" });
    if (error) return { success: false, error };
    if (!mutationLimiter.check(`pkg-duplicate:${session!.user.id}`)) return { success: false, ...rateLimitError() };

    const newId = crypto.randomUUID();
    const newName = `${source.packageName} (Copy)`;

    // Some legacy rows carry a categoryId pointing to a Category that no longer
    // exists (orphaned FK). Re-copying it verbatim trips the FK constraint, so
    // resolve which categoryIds are still live and null out the rest — matching
    // the schema's onDelete: SetNull semantics. categoryName is kept for display.
    const referencedCategoryIds = [
      ...source.categoryPrices.map((c) => c.categoryId),
      ...source.vendorItems.map((v) => v.categoryId),
    ].filter((cid): cid is string => cid !== null);
    const liveCategories = referencedCategoryIds.length
      ? await db.category.findMany({ where: { id: { in: referencedCategoryIds } }, select: { id: true } })
      : [];
    const liveCategoryIds = new Set(liveCategories.map((c) => c.id));
    const safeCategoryId = (cid: string | null): string | null => (cid && liveCategoryIds.has(cid) ? cid : null);

    // Copy as a fresh draft — no ApprovalRecord created, so approvers aren't
    // notified until the user reviews & submits the duplicate. Unavailable until approved.
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.package.create({
        data: {
          id: newId,
          packageName: newName,
          category: source.category,
          venueId: source.venueId,
          notes: source.notes,
          pax: source.pax,
          margin: source.margin,
          sellingPrice: source.sellingPrice,
          termAndCondition: source.termAndCondition,
          approvalStatus: "draft",
          available: false,
        },
      }),
      ...source.categoryPrices.map((c) =>
        db.packageCategoryPrice.create({
          data: { packageId: newId, categoryId: safeCategoryId(c.categoryId), categoryName: c.categoryName, basePrice: c.basePrice, sortOrder: c.sortOrder, isShow: c.isShow },
        })
      ),
      ...source.vendorItems.map((v) =>
        db.packageVendorItem.create({
          data: { packageId: newId, categoryId: safeCategoryId(v.categoryId), categoryName: v.categoryName, itemText: v.itemText, sortOrder: v.sortOrder },
        })
      ),
      ...source.internalItems.map((it) =>
        db.packageInternalItem.create({
          data: { packageId: newId, itemName: it.itemName, itemDescription: it.itemDescription, sortOrder: it.sortOrder },
        })
      ),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "packages.duplicate",
      entityType: mod,
      entityId: newId,
      description: `Duplicated package "${source.packageName}" → "${newName}"`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id: newId, packageName: newName } };
  } catch (e) {
    console.error("[duplicatePackage]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePackage(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const existing = await db.package.findUnique({ where: { id }, select: { category: true } });
    const mod = permModuleFor((existing?.category ?? "WEDDINGS") as PkgCategory);

    const { session, error } = await requirePermission({ module: mod, action: "delete" });
    if (error) return { success: false, error };
    if (!mutationLimiter.check(`pkg-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

    const [pkg] = await db.$transaction([db.package.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "packages.delete",
      entityType: mod,
      entityId: id,
      description: `Deleted package "${pkg.packageName}"`,
    });

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePackage]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteBulkPackages(ids: string[]): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    // Look up categories to determine which permission module is required.
    // If ALL packages are MICE → require package-mice:delete.
    // Otherwise (all wedding or mixed) → require package:delete (wedding is the stricter default).
    const pkgs = await db.package.findMany({ where: { id: { in: ids } }, select: { category: true } });
    const allMice = pkgs.length > 0 && pkgs.every((p) => p.category === "MICE");
    const mod = allMice ? "package-mice" : "package";

    const { session: sessionBulk, error: errorBulk } = await requirePermission({ module: mod, action: "delete" });
    if (errorBulk) return { success: false, error: errorBulk };
    if (!mutationLimiter.check(`pkg-bulk-delete:${sessionBulk!.user.id}`)) return { success: false, ...rateLimitError() };

    await db.$transaction([db.package.deleteMany({ where: { id: { in: ids } } })]);

    await logAudit({
      userId: sessionBulk!.user.id,
      action: "packages.bulk_delete",
      entityType: mod,
      entityId: ids.join(","),
      description: `Deleted ${ids.length} packages`,
    });

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteBulkPackages]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Vendor Items ────────────────────────────────────────────────────────────

export async function saveVendorItems(
  packageId: string,
  items: { categoryId?: string | null; categoryName: string; itemText: string }[]
): Promise<{ success: true } | { success: false; error: string }> {
  const pkg = await db.package.findUnique({ where: { id: packageId }, select: { category: true } });
  const mod = permModuleFor((pkg?.category ?? "WEDDINGS") as PkgCategory);
  const { session, error } = await requirePermission({ module: mod, action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`vendor-items:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  for (const item of items) {
    const parsed = createVendorItemSchema.safeParse({ packageId, categoryName: item.categoryName, itemText: item.itemText });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.$transaction([
      db.packageVendorItem.deleteMany({ where: { packageId } }),
      ...items.map((item, i) =>
        db.packageVendorItem.create({
          data: { packageId, categoryId: item.categoryId ?? null, categoryName: item.categoryName, itemText: item.itemText, sortOrder: i },
        })
      ),
    ]);

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveVendorItems]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Internal Items ──────────────────────────────────────────────────────────

export async function saveInternalItems(
  packageId: string,
  items: { itemName: string; itemDescription: string }[]
): Promise<{ success: true } | { success: false; error: string }> {
  const pkg = await db.package.findUnique({ where: { id: packageId }, select: { category: true } });
  const mod = permModuleFor((pkg?.category ?? "WEDDINGS") as PkgCategory);
  const { session, error } = await requirePermission({ module: mod, action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`internal-items:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  for (const item of items) {
    const parsed = createInternalItemSchema.safeParse({ packageId, ...item });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.$transaction([
      db.packageInternalItem.deleteMany({ where: { packageId } }),
      ...items.map((item, i) =>
        db.packageInternalItem.create({
          data: { packageId, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i },
        })
      ),
    ]);

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveInternalItems]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── MICE Items ───────────────────────────────────────────────────────────────

export async function saveMiceItems(
  packageId: string,
  items: { itemName: string; itemDescription: string; itemType: string; itemPrice: number }[]
): Promise<{ success: true } | { success: false; error: string }> {
  const pkg = await db.package.findUnique({ where: { id: packageId }, select: { category: true } });
  const mod = permModuleFor((pkg?.category ?? "MICE") as PkgCategory);
  const { session, error } = await requirePermission({ module: mod, action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-items:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  for (const item of items) {
    const parsed = miceItemSchema.safeParse(item);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.$transaction([
      db.packageMiceItem.deleteMany({ where: { packageId } }),
      ...items.map((item, i) =>
        db.packageMiceItem.create({
          data: {
            packageId,
            itemName: item.itemName,
            itemDescription: item.itemDescription ?? "",
            itemType: item.itemType as "PAX" | "NOMINAL",
            itemPrice: item.itemPrice,
            sortOrder: i,
          },
        })
      ),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "package.save_mice_items",
      entityType: mod,
      entityId: packageId,
      description: `Saved ${items.length} MICE item(s) for package ${packageId}`,
    });

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveMiceItems]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Package Prices ───────────────────────────────────────────────────────────

export async function savePackagePrices(
  packageId: string,
  categories: { categoryId?: string | null; categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }[],
  margin: number,
  sellingPrice: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const pkg = await db.package.findUnique({
      where: { id: packageId },
      select: { approvalStatus: true, category: true },
    });
    if (!pkg) return { success: false, error: "Package tidak ditemukan." };

    const mod = permModuleFor(pkg.category as PkgCategory);
    const { session, error } = await requirePermission({ module: mod, action: "set-harga" });
    if (error) return { success: false, error };
    if (!mutationLimiter.check(`pkg-prices:${session!.user.id}`)) return { success: false, ...rateLimitError() };

    // Set-harga does NOT re-trigger approval regardless of current status.
    // Prices can be updated freely; approval state is managed separately.
    await db.$transaction([
      db.packageCategoryPrice.deleteMany({ where: { packageId } }),
      db.packageCategoryPrice.createMany({
        data: categories.map((c) => ({
          packageId,
          categoryId: c.categoryId ?? null,
          categoryName: c.categoryName,
          basePrice: c.basePrice,
          sortOrder: c.sortOrder,
          isShow: c.isShow,
        })),
      }),
      db.package.update({ where: { id: packageId }, data: { margin, sellingPrice } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "package.set_harga",
      entityType: mod,
      entityId: packageId,
      description: `Set harga package (sellingPrice: ${sellingPrice}, margin: ${margin})`,
    });

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[savePackagePrices]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Package T&C ─────────────────────────────────────────────────────────────

export async function updatePackageTC(packageId: string, termAndCondition: string | null): Promise<
  { success: true } | { success: false; error: string }
> {
  const pkg = await db.package.findUnique({ where: { id: packageId }, select: { category: true } });
  const mod = permModuleFor((pkg?.category ?? "WEDDINGS") as PkgCategory);
  // For MICE, "term-&-condition" permission doesn't exist → requirePermission returns error.
  // This is intentional — the UI won't expose T&C for MICE anyway (can(permModule, "term-&-condition") is false).
  const { session, error } = await requirePermission({ module: mod, action: "term-&-condition" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pkg-tc:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.package.update({ where: { id: packageId }, data: { termAndCondition } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "packages.update_tc",
      entityType: "package",
      entityId: packageId,
      description: `Updated T&C for package ${packageId}`,
    });
    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[updatePackageTC]", e);
    return { success: false, error: "Gagal menyimpan T&C" };
  }
}

// ─── Toggle Available ─────────────────────────────────────────────────────────

export async function togglePackageAvailable(id: string): Promise<
  { success: true; available: boolean } | { success: false; error: string }
> {
  try {
    const pkg = await db.package.findUnique({ where: { id }, select: { available: true, category: true } });
    if (!pkg) return { success: false, error: "Package not found" };

    const mod = permModuleFor(pkg.category as PkgCategory);
    const { session, error } = await requirePermission({ module: mod, action: "set-status" });
    if (error) return { success: false, error };
    if (!mutationLimiter.check(`pkg-toggle:${session!.user.id}`)) return { success: false, ...rateLimitError() };

    const [updated] = await db.$transaction([
      db.package.update({ where: { id }, data: { available: !pkg.available } }),
    ]);

    // Notify approvers about soft-delete scenario (available toggled on approved package)
    if (!updated.available) {
      const approvalRecord = await db.approvalRecord.findUnique({
        where: { module_entityId: { module: mod, entityId: id } },
        select: {
          steps: {
            where: { status: "approved" },
            select: { decidedById: true },
          },
        },
      });

      const decidedByIds = (approvalRecord?.steps ?? [])
        .map((s) => s.decidedById)
        .filter((profileId): profileId is string => profileId !== null);

      if (decidedByIds.length > 0) {
        void createNotifications(
          decidedByIds.map((userId) => ({
            userId,
            title: "Package Dinonaktifkan",
            message: `Package "${updated.packageName}" telah dinonaktifkan.`,
            type: "package",
            entityType: "package",
            entityId: id,
          }))
        );
      }
    }

    revalidateTag("packages", "max");
    return { success: true, available: updated.available };
  } catch (err) {
    console.error("[togglePackageAvailable]", err);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Unverify Package (Approved → Draft) ─────────────────────────────────────

/** Reset a package's approval status from "approved" back to "draft".
 *  Requires the same "set-status" permission used to approve.
 *  This does NOT touch existing ApprovalRecord steps — manager must re-approve. */
export async function unverifyPackage(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const pkg = await db.package.findUnique({
      where: { id },
      select: { approvalStatus: true, packageName: true, category: true },
    });
    if (!pkg) return { success: false, error: "Package tidak ditemukan." };
    if (pkg.approvalStatus !== "approved") {
      return { success: false, error: "Hanya package dengan status Approved yang dapat di-unverify." };
    }

    const mod = permModuleFor(pkg.category as PkgCategory);
    const { session, error } = await requirePermission({ module: mod, action: "set-status" });
    if (error) return { success: false, error };
    if (!mutationLimiter.check(`pkg-unverify:${session!.user.id}`)) return { success: false, ...rateLimitError() };

    await db.$transaction([
      db.package.update({ where: { id }, data: { approvalStatus: "draft" } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "package.unverify",
      entityType: mod,
      entityId: id,
      description: `Package "${pkg.packageName}" di-reset dari approved ke draft`,
    });

    revalidateTag("packages", "max");
    return { success: true };
  } catch (err) {
    console.error("[unverifyPackage]", err);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
