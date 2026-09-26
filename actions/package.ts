"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { resolveApprovalSteps } from "@/lib/approval-flows";
import { createNotifications } from "@/lib/notifications";
import {
  createPackageSchema,
  updatePackageSchema,
  createVendorItemSchema,
  createInternalItemSchema,
  saveMicePackageSchema,
} from "@/lib/validations/package";
import type { Session } from "next-auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PkgCategory = "WEDDINGS" | "MICE";

function permModuleFor(category: PkgCategory): "package" | "package-mice" {
  return category === "MICE" ? "package-mice" : "package";
}

/**
 * termAndCondition is normally edited via the dedicated updatePackageTC() action
 * (gated by its own "term-&-condition" permission). The MICE drawer now also lets
 * termAndCondition — and, alongside it, cancellationRefundPolicy and closingNote
 * (Step 4 "Cancellation & Refund Policy" / "Closing", same editor/gate as
 * Term & Payment) — ride along inside create/update payloads for convenience.
 * We re-check the same permission here and silently strip all three fields
 * when the caller lacks it, instead of failing the whole create/update.
 */
async function stripTermAndConditionIfUnauthorized<
  T extends { termAndCondition?: string | null; cancellationRefundPolicy?: string | null; closingNote?: string | null }
>(
  data: T,
  mod: "package" | "package-mice",
  session: Session
): Promise<T> {
  if (data.termAndCondition === undefined && data.cancellationRefundPolicy === undefined && data.closingNote === undefined) {
    return data;
  }
  const allowed = await hasPermission(session.user.roleId, mod, "term-&-condition", session.user.isSuperAdmin);
  if (allowed) return data;
  const { termAndCondition: _ignoredTc, cancellationRefundPolicy: _ignoredCrp, closingNote: _ignoredClosing, ...rest } = data;
  return rest as T;
}

// ─── Package CRUD ────────────────────────────────────────────────────────────

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
    const { signature, ...rawPkgData } = parsed.data;
    const pkgData = await stripTermAndConditionIfUnauthorized(rawPkgData, mod, session!);

    const packageId = crypto.randomUUID();
    const creatorProfileId = session!.user.profileId!;

    if (mod === "package-mice") {
      // MICE packages have no approval flow — created directly as approved.
      await db.$transaction([
        db.package.create({
          data: {
            id: packageId,
            ...pkgData,
            approvalStatus: "approved",
            createdById: creatorProfileId,
            updatedById: creatorProfileId,
          },
        }),
      ]);
    } else {
      const steps = await resolveApprovalSteps(mod);
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
        db.package.create({
          data: {
            id: packageId,
            ...pkgData,
            approvalStatus: "pending",
            createdById: creatorProfileId,
            updatedById: creatorProfileId,
          },
        }),
        ...(steps && steps.length > 0
          ? [
              db.approvalRecord.create({
                data: {
                  id: recordId,
                  module: mod,
                  entityId: packageId,
                  status: "pending",
                  createdById: creatorProfileId,
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
                    decidedById: shouldAutoApprove ? creatorProfileId : null,
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
    }

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
  const { signature, category: _ignoredCategory, ...rawPkgData } = parsed.data;

  // Detect pax change (triggers approval reset) + fetch category for permission module
  const existing = await db.package.findUnique({ where: { id }, select: { pax: true, approvalStatus: true, category: true } });
  const paxChanged = rawPkgData.pax !== undefined && existing?.pax !== rawPkgData.pax;
  const mod = permModuleFor((existing?.category ?? "WEDDINGS") as PkgCategory);

  const { session, error } = await requirePermission({ module: mod, action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pkg-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const pkgData = await stripTermAndConditionIfUnauthorized(rawPkgData, mod, session!);

  try {
    const updaterProfileId = session!.user.profileId!;

    if (mod === "package-mice") {
      // MICE packages have no approval flow — just update, keep approvalStatus.
      await db.$transaction([
        db.package.update({
          where: { id },
          data: { ...pkgData, updatedById: updaterProfileId },
        }),
      ]);
    } else {
      const [steps, existingApproval] = await Promise.all([
        resolveApprovalSteps(mod),
        db.approvalRecord.findUnique({
          where: { module_entityId: { module: mod, entityId: id } },
          select: { id: true },
        }),
      ]);

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
        db.package.update({ where: { id }, data: { ...pkgData, approvalStatus: "pending", updatedById: updaterProfileId } }),
        ...(steps && steps.length > 0
          ? [
              db.approvalRecordStep.deleteMany({ where: { recordId } }),
              existingApproval
                ? db.approvalRecord.update({
                    where: { id: existingApproval.id },
                    data: {
                      status: "pending",
                      updatedById: updaterProfileId,
                    },
                  })
                : db.approvalRecord.create({
                    data: {
                      id: recordId,
                      module: mod,
                      entityId: id,
                      status: "pending",
                      createdById: updaterProfileId,
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
                    decidedById: shouldAutoApprove ? updaterProfileId : null,
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
    }

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

// ─── MICE Package save (create/edit + all sub-collections in ONE transaction) ──

export async function saveMicePackage(data: unknown): Promise<
  { success: true; data: { id: string } } | { success: false; error: string }
> {
  const parsed = saveMicePackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, ...rest } = parsed.data;
  const isEdit = !!id;

  const { session, error } = await requirePermission({ module: "package-mice", action: isEdit ? "edit" : "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-pkg-save:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const profileId = session!.user.profileId!;
    const packageId = id ?? crypto.randomUUID();

    const tc = await stripTermAndConditionIfUnauthorized(
      {
        termAndCondition: rest.termAndCondition,
        cancellationRefundPolicy: rest.cancellationRefundPolicy,
        closingNote: rest.closingNote,
      },
      "package-mice",
      session!,
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (isEdit) {
      ops.push(
        db.package.update({
          where: { id: packageId },
          data: {
            packageName: rest.packageName,
            available: rest.available,
            venueId: rest.venueId ?? null,
            eventTypeId: rest.eventTypeId ?? null,
            notes: rest.notes ?? null,
            paymentMethodId: rest.paymentMethodId ?? null,
            ...tc,
            updatedById: profileId,
          },
        }),
      );
    } else {
      ops.push(
        db.package.create({
          data: {
            id: packageId,
            packageName: rest.packageName,
            available: rest.available,
            venueId: rest.venueId ?? null,
            eventTypeId: rest.eventTypeId ?? null,
            notes: rest.notes ?? null,
            paymentMethodId: rest.paymentMethodId ?? null,
            ...tc,
            category: "MICE",
            approvalStatus: "approved",
            createdById: profileId,
            updatedById: profileId,
          },
        }),
      );
    }

    ops.push(db.packageMiceItem.deleteMany({ where: { packageId } }));
    ops.push(
      ...rest.items.map((it, i) =>
        db.packageMiceItem.create({
          data: { packageId, itemName: it.itemName, itemDescription: it.itemDescription ?? "", sortOrder: i },
        }),
      ),
    );

    ops.push(db.packageMiceTaxDeposit.deleteMany({ where: { packageId } }));
    ops.push(
      ...rest.taxDeposits.map((td, i) =>
        db.packageMiceTaxDeposit.create({
          data: { packageId, name: td.name, nominal: td.nominal, sortOrder: i },
        }),
      ),
    );

    ops.push(db.packageMicePrice.deleteMany({ where: { packageId } }));
    ops.push(
      ...rest.prices.map((p, i) =>
        db.packageMicePrice.create({
          data: {
            packageId,
            name: p.name,
            description: p.description ?? null,
            priceType: p.priceType,
            qty: p.priceType === "QTY" ? (p.qty ?? null) : null,
            price: p.priceType === "QTY" ? (p.price ?? null) : null,
            total: p.total,
            sortOrder: i,
          },
        }),
      ),
    );

    ops.push(db.packageComplimentary.deleteMany({ where: { packageId } }));
    ops.push(
      ...rest.complimentaries.map((c, i) =>
        db.packageComplimentary.create({
          data: {
            packageId,
            complimentaryId: c.complimentaryId ?? null,
            name: c.name,
            price: c.price,
            isShowPrice: c.isShowPrice,
            description: c.description ?? null,
            qty: c.qty,
            sortOrder: i,
          },
        }),
      ),
    );

    ops.push(db.packageBonus.deleteMany({ where: { packageId } }));
    ops.push(
      ...rest.bonuses.map((b, i) =>
        db.packageBonus.create({
          data: {
            packageId,
            bonusId: b.bonusId ?? null,
            name: b.name,
            price: b.price,
            description: b.description ?? null,
            qty: b.qty,
            sortOrder: i,
          },
        }),
      ),
    );

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: isEdit ? "packages.update" : "packages.create",
      entityType: "package-mice",
      entityId: packageId,
      description: isEdit ? `Updated MICE package "${rest.packageName}"` : `Created MICE package "${rest.packageName}"`,
    });

    revalidateTag("packages", "max");
    return { success: true, data: { id: packageId } };
  } catch (e) {
    console.error("[saveMicePackage]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan paket MICE." };
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
        packageTypeCategoryId: true,
        eventTypeId: true,
        paymentMethodId: true,
        notes: true,
        pax: true,
        margin: true,
        sellingPrice: true,
        termAndCondition: true,
        cancellationRefundPolicy: true,
        closingNote: true,
        categoryPrices: { select: { categoryId: true, categoryName: true, basePrice: true, sortOrder: true, isShow: true } },
        vendorItems: { select: { categoryId: true, categoryName: true, itemText: true, sortOrder: true } },
        internalItems: { select: { itemName: true, itemDescription: true, sortOrder: true } },
        miceItems: { select: { itemName: true, itemDescription: true, sortOrder: true } },
        micePrices: { select: { name: true, description: true, priceType: true, qty: true, price: true, total: true, sortOrder: true } },
        taxDeposits: { select: { name: true, nominal: true, sortOrder: true } },
        complimentaries: { select: { complimentaryId: true, name: true, price: true, isShowPrice: true, description: true, qty: true, sortOrder: true } },
        bonuses: { select: { bonusId: true, name: true, price: true, description: true, qty: true, sortOrder: true } },
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
    // notified until the user reviews & submits the duplicate. MICE packages have
    // no approval flow, but every duplicate starts unavailable for explicit review.
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.package.create({
        data: {
          id: newId,
          packageName: newName,
          category: source.category,
          venueId: source.venueId,
          packageTypeCategoryId: source.packageTypeCategoryId,
          eventTypeId: source.eventTypeId,
          paymentMethodId: source.paymentMethodId,
          notes: source.notes,
          pax: source.pax,
          margin: source.margin,
          sellingPrice: source.sellingPrice,
          termAndCondition: source.termAndCondition,
          cancellationRefundPolicy: source.cancellationRefundPolicy,
          closingNote: source.closingNote,
          approvalStatus: source.category === "MICE" ? "approved" : "draft",
          available: false,
          createdById: session!.user.profileId!,
          updatedById: session!.user.profileId!,
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
      ...source.miceItems.map((it) =>
        db.packageMiceItem.create({
          data: { packageId: newId, itemName: it.itemName, itemDescription: it.itemDescription, sortOrder: it.sortOrder },
        })
      ),
      ...source.micePrices.map((price) =>
        db.packageMicePrice.create({
          data: { packageId: newId, name: price.name, description: price.description, priceType: price.priceType, qty: price.qty, price: price.price, total: price.total, sortOrder: price.sortOrder },
        })
      ),
      ...source.taxDeposits.map((taxDeposit) =>
        db.packageMiceTaxDeposit.create({
          data: { packageId: newId, name: taxDeposit.name, nominal: taxDeposit.nominal, sortOrder: taxDeposit.sortOrder },
        })
      ),
      ...source.complimentaries.map((complimentary) =>
        db.packageComplimentary.create({
          data: { packageId: newId, complimentaryId: complimentary.complimentaryId, name: complimentary.name, price: complimentary.price, isShowPrice: complimentary.isShowPrice, description: complimentary.description, qty: complimentary.qty, sortOrder: complimentary.sortOrder },
        })
      ),
      ...source.bonuses.map((bonus) =>
        db.packageBonus.create({
          data: { packageId: newId, bonusId: bonus.bonusId, name: bonus.name, price: bonus.price, description: bonus.description, qty: bonus.qty, sortOrder: bonus.sortOrder },
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
