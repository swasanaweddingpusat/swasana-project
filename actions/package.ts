"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createPackageSchema,
  updatePackageSchema,
  createVariantSchema,
  dbCreateVariantSchema,
  dbUpdateVariantSchema,
  updateVariantSchema,
  createVendorItemSchema,
  createInternalItemSchema,
} from "@/lib/validations/package";

// ─── Package CRUD ────────────────────────────────────────────────────────────

export async function createPackage(data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createPackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const pkg = await db.package.create({ data: parsed.data });

  await logAudit({
    userId: session.user.id,
    action: "packages.create",
    entityType: "package",
    entityId: pkg.id,
    description: `Created package "${pkg.packageName}"`,
  });

  return { success: true, data: pkg };
}

export async function updatePackage(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updatePackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await db.package.update({ where: { id }, data: parsed.data });
  const pkg = await db.package.findUnique({
    where: { id },
    include: {
      venue: { select: { id: true, name: true, address: true, brandId: true } },
      variants: { include: { vendorItems: true, internalItems: true, package_variant_category_prices: true } },
    },
  });

  if (!pkg) return { success: false, error: "Package tidak ditemukan." };

  await logAudit({
    userId: session.user.id,
    action: "packages.update",
    entityType: "package",
    entityId: pkg.id,
    description: `Updated package "${pkg.packageName}"`,
  });

  return { success: true, data: pkg };
}

export async function deletePackage(id: string) {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const pkg = await db.package.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: "packages.delete",
    entityType: "package",
    entityId: id,
    description: `Deleted package "${pkg.packageName}"`,
  });

  return { success: true };
}

export async function deleteBulkPackages(ids: string[]) {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pkg-bulk-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  await db.package.deleteMany({ where: { id: { in: ids } } });

  await logAudit({
    userId: session.user.id,
    action: "packages.bulk_delete",
    entityType: "package",
    entityId: ids.join(","),
    description: `Deleted ${ids.length} packages`,
  });

  return { success: true };
}

// ─── Variant CRUD ────────────────────────────────────────────────────────────

export async function createVariant(data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  // First parse with full schema to get price validation
  const fullParsed = createVariantSchema.safeParse(data);
  if (!fullParsed.success) return { success: false, error: fullParsed.error.issues[0].message };

  // Then parse for DB (without price)
  const dbParsed = dbCreateVariantSchema.safeParse(data);
  if (!dbParsed.success) return { success: false, error: dbParsed.error.issues[0].message };

  const price = fullParsed.data.price;
  const variantData = dbParsed.data;

  const variant = await db.packageVariant.create({ data: variantData });

  // Save price to package_variant_category_prices
  if (price && price > 0) {
    await db.package_variant_category_prices.create({
      data: {
        id: `pvcp-${variant.id}-${Date.now()}`,
        packageVariantId: variant.id,
        categoryName: "Base Price",
        basePrice: price,
        updatedAt: new Date(),
      },
    });
  }

  return { success: true, data: variant };
}

export async function updateVariant(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  // Parse with full schema first to validate price
  const fullParsed = updateVariantSchema.safeParse(data);
  if (!fullParsed.success) return { success: false, error: fullParsed.error.issues[0].message };

  // Parse for DB update (without price)
  const dbParsed = dbUpdateVariantSchema.safeParse(data);
  if (!dbParsed.success) return { success: false, error: dbParsed.error.issues[0].message };

  const price = (fullParsed.data as any).price;
  const variantData = dbParsed.data;

  // Update variant fields (excluding price)
  const variant = await db.packageVariant.update({ where: { id }, data: variantData });

  // Update or create price in package_variant_category_prices
  if (price !== undefined && price !== null) {
    const existing = await db.package_variant_category_prices.findFirst({
      where: { packageVariantId: id, categoryName: "Base Price" },
    });

    if (existing) {
      await db.package_variant_category_prices.update({
        where: { id: existing.id },
        data: { basePrice: price, updatedAt: new Date() },
      });
    } else {
      await db.package_variant_category_prices.create({
        data: {
          id: `pvcp-${id}-${Date.now()}`,
          packageVariantId: id,
          categoryName: "Base Price",
          basePrice: price,
          updatedAt: new Date(),
        },
      });
    }
  }

  return { success: true, data: variant };
}

export async function deleteVariant(id: string) {
  const permResult = await requirePermission({ module: "package", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`variant-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  await db.packageVariant.delete({ where: { id } });
  return { success: true };
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

  await db.$transaction([
    db.packageVendorItem.deleteMany({ where: { packageVariantId } }),
    ...items.map((item) =>
      db.packageVendorItem.create({
        data: { packageVariantId, categoryName: item.categoryName, itemText: item.itemText },
      })
    ),
  ]);

  return { success: true };
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

  await db.$transaction([
    db.packageInternalItem.deleteMany({ where: { packageVariantId } }),
    ...items.map((item) =>
      db.packageInternalItem.create({
        data: { packageVariantId, itemName: item.itemName, itemDescription: item.itemDescription },
      })
    ),
  ]);

  return { success: true };
}
