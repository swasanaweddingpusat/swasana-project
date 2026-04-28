"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createPackageSchema,
  updatePackageSchema,
  createVariantSchema,
  updateVariantSchema,
  createVendorItemSchema,
  createInternalItemSchema,
} from "@/lib/validations/package";

// ─── Package CRUD ────────────────────────────────────────────────────────────

export async function getPackageCreatedBy(packageId: string): Promise<string | null> {
  try {
    const record = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "package", entityId: packageId } },
      select: { createdBy: { select: { fullName: true } } },
    });
    return record?.createdBy?.fullName ?? null;
  } catch (e) {
    console.error("[getPackageCreatedBy]", e);
    return null;
  }
}

export async function createPackage(data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createPackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const { signature, ...pkgData } = parsed.data;

    // Fetch flow outside transaction (read-only)
    const flow = await db.approvalFlow.findUnique({
      where: { module: "package" },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    });

    const pkg = await db.$transaction(async (tx) => {
      const created = await tx.package.create({ data: { ...pkgData, approvalStatus: "pending" } });

      if (flow && flow.steps.length > 0) {
        const record = await tx.approvalRecord.create({
          data: { module: "package", entityId: created.id, status: "pending", createdById: session.user.profileId, signature: signature ?? null },
        });

        const creatorRoleId = session.user.roleId;
        const creatorStepIdx = flow.steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === creatorRoleId);

        for (let i = 0; i < flow.steps.length; i++) {
          const step = flow.steps[i];
          const shouldAutoApprove = creatorStepIdx >= 0 && i <= creatorStepIdx;
          const isCreatorStep = i === creatorStepIdx;

          await tx.approvalRecordStep.create({
            data: {
              recordId: record.id, stepOrder: step.sortOrder, approverType: step.approverType,
              approverRoleId: step.approverRoleId, approverUserId: step.approverUserId,
              status: shouldAutoApprove ? "approved" : "pending",
              decidedById: shouldAutoApprove ? session.user.profileId : null,
              decidedAt: shouldAutoApprove ? new Date() : null,
              signature: isCreatorStep ? (signature ?? null) : null,
            },
          });
        }

        const allSteps = await tx.approvalRecordStep.findMany({ where: { recordId: record.id } });
        const allApproved = allSteps.every((s) => s.status === "approved");
        if (allApproved) {
          await tx.approvalRecord.update({ where: { id: record.id }, data: { status: "approved" } });
          await tx.package.update({ where: { id: created.id }, data: { approvalStatus: "approved" } });
        }
      }

      return created;
    });

    await logAudit({
      userId: session.user.id,
      action: "packages.create",
      entityType: "package",
      entityId: pkg.id,
      description: `Created package "${pkg.packageName}"`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: pkg };
  } catch (e) {
    console.error("[createPackage]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updatePackage(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updatePackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { signature, ...pkgData } = parsed.data;

  const flow = await db.approvalFlow.findUnique({
    where: { module: "package" },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });

  try {
    await db.$transaction(async (tx) => {
      await tx.package.update({ where: { id }, data: { ...pkgData, approvalStatus: "pending" } });

      if (flow && flow.steps.length > 0) {
        // Delete existing approval record (cascade deletes steps)
        await tx.approvalRecord.deleteMany({ where: { module: "package", entityId: id } });

        const record = await tx.approvalRecord.create({
          data: { module: "package", entityId: id, status: "pending", createdById: session.user.profileId, signature: signature ?? null },
        });

        const creatorRoleId = session.user.roleId;
        const creatorStepIdx = flow.steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === creatorRoleId);

        for (let i = 0; i < flow.steps.length; i++) {
          const step = flow.steps[i];
          const shouldAutoApprove = creatorStepIdx >= 0 && i <= creatorStepIdx;
          await tx.approvalRecordStep.create({
            data: {
              recordId: record.id, stepOrder: step.sortOrder, approverType: step.approverType,
              approverRoleId: step.approverRoleId, approverUserId: step.approverUserId,
              status: shouldAutoApprove ? "approved" : "pending",
              decidedById: shouldAutoApprove ? session.user.profileId : null,
              decidedAt: shouldAutoApprove ? new Date() : null,
              signature: i === creatorStepIdx ? (signature ?? null) : null,
            },
          });
        }

        const allSteps = await tx.approvalRecordStep.findMany({ where: { recordId: record.id } });
        if (allSteps.every((s) => s.status === "approved")) {
          await tx.approvalRecord.update({ where: { id: record.id }, data: { status: "approved" } });
          await tx.package.update({ where: { id }, data: { approvalStatus: "approved" } });
        }
      }
    });

    await logAudit({
      userId: session.user.id,
      action: "packages.update",
      entityType: "package",
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

export async function deletePackage(id: string) {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const [pkg] = await db.$transaction([db.package.delete({ where: { id } })]);

    await logAudit({
      userId: session.user.id,
      action: "packages.delete",
      entityType: "package",
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

export async function deleteBulkPackages(ids: string[]) {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-bulk-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.package.deleteMany({ where: { id: { in: ids } } })]);

    await logAudit({
      userId: session.user.id,
      action: "packages.bulk_delete",
      entityType: "package",
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

// ─── Variant CRUD ────────────────────────────────────────────────────────────

export async function createVariant(data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createVariantSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const variant = await db.packageVariant.create({ data: parsed.data });
    revalidateTag("packages", "max");
    return { success: true, data: variant };
  } catch (e) {
    console.error("[createVariant]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateVariant(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateVariantSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const variant = await db.packageVariant.update({ where: { id }, data: parsed.data });
    revalidateTag("packages", "max");
    return { success: true, data: variant };
  } catch (e) {
    console.error("[updateVariant]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteVariant(id: string) {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.packageVariant.delete({ where: { id } });
    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteVariant]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Vendor Items ────────────────────────────────────────────────────────────

export async function saveVendorItems(
  packageVariantId: string,
  items: { categoryName: string; itemText: string }[]
) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-items:${session.user.id}`)) return { success: false, ...rateLimitError() };

  for (const item of items) {
    const parsed = createVendorItemSchema.safeParse({ packageVariantId, ...item });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.$transaction([
      db.packageVendorItem.deleteMany({ where: { packageVariantId } }),
      ...items.map((item) =>
        db.packageVendorItem.create({
          data: { packageVariantId, categoryName: item.categoryName, itemText: item.itemText },
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
  packageVariantId: string,
  items: { itemName: string; itemDescription: string }[]
) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`internal-items:${session.user.id}`)) return { success: false, ...rateLimitError() };

  for (const item of items) {
    const parsed = createInternalItemSchema.safeParse({ packageVariantId, ...item });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await db.$transaction([
      db.packageInternalItem.deleteMany({ where: { packageVariantId } }),
      ...items.map((item) =>
        db.packageInternalItem.create({
          data: { packageVariantId, itemName: item.itemName, itemDescription: item.itemDescription },
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

export async function saveVariantPrices(
  variantId: string,
  categories: { categoryName: string; basePrice: number; sortOrder: number }[],
  margin: number
) {
  const permResult = await requirePermission({ module: "package", action: "set_harga" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-prices:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.packageVariantCategoryPrice.deleteMany({ where: { packageVariantId: variantId } }),
      db.packageVariantCategoryPrice.createMany({
        data: categories.map((c) => ({
          packageVariantId: variantId,
          categoryName: c.categoryName,
          basePrice: c.basePrice,
          sortOrder: c.sortOrder,
        })),
      }),
      db.packageVariant.update({ where: { id: variantId }, data: { margin } }),
    ]);

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveVariantPrices]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
