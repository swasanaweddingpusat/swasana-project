"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { buildResetApprovalOps } from "@/lib/approval-helpers";
import { createNotifications } from "@/lib/notifications";
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

    const flow = await db.approvalFlow.findUnique({
      where: { module: "package" },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    });

    const packageId = crypto.randomUUID();
    const recordId = crypto.randomUUID();
    const now = new Date();
    const creatorRoleId = session.user.roleId;
    const creatorStepIdx = flow ? flow.steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === creatorRoleId) : -1;
    const allAutoApproved = flow && flow.steps.length > 0 && flow.steps.every((_, i) => creatorStepIdx >= 0 ? i <= creatorStepIdx : i === 0);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.package.create({ data: { id: packageId, ...pkgData, approvalStatus: "pending" } }),
      ...(flow && flow.steps.length > 0 ? [
        db.approvalRecord.create({
          data: { id: recordId, module: "package", entityId: packageId, status: "pending", createdById: session.user.profileId!, signature: signature ?? null },
        }),
        ...flow.steps.map((step, i) => {
          const shouldAutoApprove = creatorStepIdx >= 0 ? i <= creatorStepIdx : i === 0;
          const isCreatorStep = creatorStepIdx >= 0 ? i === creatorStepIdx : i === 0;
          return db.approvalRecordStep.create({
            data: {
              recordId, stepOrder: step.sortOrder, approverType: step.approverType,
              approverRoleId: step.approverRoleId ?? null, approverUserId: step.approverUserId ?? null,
              status: shouldAutoApprove ? "approved" : "pending",
              decidedById: shouldAutoApprove ? session.user.profileId! : null,
              decidedAt: shouldAutoApprove ? now : null,
              signature: isCreatorStep ? (signature ?? null) : null,
            },
          });
        }),
        ...(allAutoApproved ? [
          db.approvalRecord.update({ where: { id: recordId }, data: { status: "approved" } }),
          db.package.update({ where: { id: packageId }, data: { approvalStatus: "approved" } }),
        ] : []),
      ] : []),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session.user.id,
      action: "packages.create",
      entityType: "package",
      entityId: packageId,
      description: `Created package "${pkgData.packageName}"`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id: packageId, ...pkgData } };
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

  // Read-only queries before transaction
  const [flow, existing] = await Promise.all([
    db.approvalFlow.findUnique({ where: { module: "package" }, include: { steps: { orderBy: { sortOrder: "asc" } } } }),
    db.approvalRecord.findUnique({ where: { module_entityId: { module: "package", entityId: id } }, select: { id: true } }),
  ]);

  try {
    const recordId = existing?.id ?? crypto.randomUUID();
    const now = new Date();
    const creatorRoleId = session.user.roleId;
    const creatorStepIdx = flow ? flow.steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === creatorRoleId) : -1;
    const allAutoApproved = flow && flow.steps.length > 0 && flow.steps.every((_, i) => creatorStepIdx >= 0 ? i <= creatorStepIdx : i === 0);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.package.update({ where: { id }, data: { ...pkgData, approvalStatus: "pending" } }),
      ...(flow && flow.steps.length > 0 ? [
        db.approvalRecordStep.deleteMany({ where: { recordId } }),
        existing
          ? db.approvalRecord.update({ where: { id: existing.id }, data: { status: "pending", updatedById: session.user.profileId!, signature: signature ?? null } })
          : db.approvalRecord.create({ data: { id: recordId, module: "package", entityId: id, status: "pending", createdById: session.user.profileId!, signature: signature ?? null } }),
        ...flow.steps.map((step, i) => {
          const shouldAutoApprove = creatorStepIdx >= 0 ? i <= creatorStepIdx : i === 0;
          const isCreatorStep = creatorStepIdx >= 0 ? i === creatorStepIdx : i === 0;
          return db.approvalRecordStep.create({
            data: {
              recordId, stepOrder: step.sortOrder, approverType: step.approverType,
              approverRoleId: step.approverRoleId ?? null, approverUserId: step.approverUserId ?? null,
              status: shouldAutoApprove ? "approved" : "pending",
              decidedById: shouldAutoApprove ? session.user.profileId! : null,
              decidedAt: shouldAutoApprove ? now : null,
              signature: isCreatorStep ? (signature ?? null) : null,
            },
          });
        }),
        ...(allAutoApproved ? [
          db.approvalRecord.update({ where: { id: recordId }, data: { status: "approved" } }),
          db.package.update({ where: { id }, data: { approvalStatus: "approved" } }),
        ] : []),
      ] : []),
    ];

    await db.$transaction(ops);

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

export async function createVariant(data: unknown): Promise<
  { success: true; data: { id: string } } | { success: false; error: string }
> {
  const permResult = await requirePermission({ module: "package", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-create:${session.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createVariantSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { packageId } = parsed.data;

  try {
    const pkg = await db.package.findUnique({
      where: { id: packageId },
      select: { approvalStatus: true },
    });
    if (!pkg) return { success: false, error: "Package tidak ditemukan." };

    const variantId = crypto.randomUUID();

    if (pkg.approvalStatus === "approved") {
      const resetOps = await buildResetApprovalOps(packageId, {
        profileId: session.user.profileId,
        roleId: session.user.roleId,
      });

      await db.$transaction([
        db.packageVariant.create({ data: { id: variantId, ...parsed.data } }),
        ...resetOps,
      ]);

      await logAudit({
        userId: session.user.id,
        action: "package.approval_reset",
        entityType: "package",
        entityId: packageId,
        description: `Approval reset: variant baru ditambahkan ke approved package`,
      });
    } else {
      await db.$transaction([
        db.packageVariant.create({ data: { id: variantId, ...parsed.data } }),
      ]);
    }

    await logAudit({
      userId: session.user.id,
      action: "packages.variant_create",
      entityType: "packageVariant",
      entityId: variantId,
      description: `Created variant for package ${packageId}`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id: variantId } };
  } catch (e) {
    console.error("[createVariant]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateVariant(id: string, data: unknown): Promise<
  { success: true; data: { id: string } } | { success: false; error: string }
> {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-update:${session.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateVariantSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.packageVariant.findUnique({
      where: { id },
      select: {
        variantName: true,
        pax: true,
        packageId: true,
        package: { select: { approvalStatus: true } },
      },
    });
    if (!existing) return { success: false, error: "Variant tidak ditemukan." };

    const { packageId } = existing;
    const approvalStatus = existing.package.approvalStatus;

    const incomingName = parsed.data.variantName?.trim();
    const incomingPax = parsed.data.pax;
    const nameChanged =
      incomingName !== undefined && incomingName !== existing.variantName.trim();
    const paxChanged =
      incomingPax !== undefined && incomingPax !== existing.pax;
    const shouldReset = approvalStatus === "approved" && (nameChanged || paxChanged);

    if (shouldReset) {
      const resetOps = await buildResetApprovalOps(packageId, {
        profileId: session.user.profileId,
        roleId: session.user.roleId,
      });

      await db.$transaction([
        db.packageVariant.update({ where: { id }, data: parsed.data }),
        ...resetOps,
      ]);

      await logAudit({
        userId: session.user.id,
        action: "package.approval_reset",
        entityType: "package",
        entityId: packageId,
        description: `Approval reset: name/pax variant berubah pada approved package`,
      });
    } else {
      await db.$transaction([
        db.packageVariant.update({ where: { id }, data: parsed.data }),
      ]);
    }

    await logAudit({
      userId: session.user.id,
      action: "packages.variant_update",
      entityType: "packageVariant",
      entityId: id,
      description: `Updated variant ${id}`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[updateVariant]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteVariant(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-delete:${session.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const variant = await db.packageVariant.findUnique({
      where: { id },
      select: {
        variantName: true,
        packageId: true,
        package: {
          select: {
            approvalStatus: true,
            packageName: true,
          },
        },
      },
    });
    if (!variant) return { success: false, error: "Variant tidak ditemukan." };

    const { packageId } = variant;
    const approvalStatus = variant.package.approvalStatus;

    if (approvalStatus === "approved") {
      await db.$transaction([
        db.packageVariant.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      ]);

      const approvalRecord = await db.approvalRecord.findUnique({
        where: { module_entityId: { module: "package", entityId: packageId } },
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
            title: "Variant Paket Dihapus",
            message: `Variant "${variant.variantName}" dari package "${variant.package.packageName}" telah dihapus.`,
            type: "package",
            entityType: "package",
            entityId: packageId,
          }))
        );
      }

      await logAudit({
        userId: session.user.id,
        action: "package.variant_soft_deleted",
        entityType: "packageVariant",
        entityId: id,
        description: `Soft deleted variant "${variant.variantName}" dari package ${packageId}`,
      });
    } else {
      await db.$transaction([
        db.packageVariant.delete({ where: { id } }),
      ]);

      await logAudit({
        userId: session.user.id,
        action: "packages.variant_delete",
        entityType: "packageVariant",
        entityId: id,
        description: `Deleted variant ${id}`,
      });
    }

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
  categories: { categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }[],
  margin: number,
  sellingPrice: number
) {
  const permResult = await requirePermission({ module: "package", action: "set-harga" });
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
          isShow: c.isShow,
        })),
      }),
      db.packageVariant.update({ where: { id: variantId }, data: { margin, sellingPrice } }),
    ]);

    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveVariantPrices]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Variant T&C ─────────────────────────────────────────────────────────────

export async function updateVariantTC(variantId: string, termAndCondition: string | null): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const permResult = await requirePermission({ module: "package", action: "term-&-condition" });
    if (permResult.error) return { success: false, error: permResult.error };
    const session = permResult.session!;
    if (!mutationLimiter.check(`variant-tc:${session.user.id}`)) return { success: false, ...rateLimitError() };

    await db.$transaction([
      db.packageVariant.update({ where: { id: variantId }, data: { termAndCondition } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "packages.update_tc",
      entityType: "package",
      entityId: variantId,
      description: `Updated T&C for variant ${variantId}`,
    });
    revalidateTag("packages", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateVariantTC]", e);
    return { success: false, error: "Gagal menyimpan T&C" };
  }
}

// ─── Toggle Available ─────────────────────────────────────────────────────────

export async function togglePackageAvailable(id: string): Promise<{ success: true; available: boolean } | { success: false; error: string }> {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-toggle:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const pkg = await db.package.findUnique({ where: { id }, select: { available: true } });
    if (!pkg) return { success: false, error: "Package not found" };

    const [updated] = await db.$transaction([
      db.package.update({ where: { id }, data: { available: !pkg.available } }),
    ]);

    revalidateTag("packages", "max");
    return { success: true, available: updated.available };
  } catch (err) {
    console.error("[togglePackageAvailable]", err);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
