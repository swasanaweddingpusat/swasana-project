"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createVendorCategorySchema,
  updateVendorCategorySchema,
  createVendorSchema,
  updateVendorSchema,
} from "@/lib/validations/vendor";

// ─── Vendor Category ─────────────────────────────────────────────────────────

export async function createVendorCategory(data: unknown) {
  const permResult = await requirePermission({ module: "vendor", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-cat-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createVendorCategorySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [category] = await db.$transaction([db.vendorCategory.create({ data: parsed.data })]);

    await logAudit({
      userId: session.user.id,
      action: "vendor_category.create",
      entityType: "vendor_category",
      entityId: category.id,
      description: `Created vendor category "${category.name}"`,
    });

    revalidateTag("vendors", "max");
    return { success: true, data: category };
  } catch (e) {
    console.error("[createVendorCategory]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateVendorCategory(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "vendor", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-cat-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateVendorCategorySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [category] = await db.$transaction([db.vendorCategory.update({ where: { id }, data: parsed.data })]);

    await logAudit({
      userId: session.user.id,
      action: "vendor_category.update",
      entityType: "vendor_category",
      entityId: id,
      description: `Updated vendor category "${category.name}"`,
    });

    revalidateTag("vendors", "max");
    return { success: true, data: category };
  } catch (e) {
    console.error("[updateVendorCategory]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteVendorCategory(id: string) {
  const permResult = await requirePermission({ module: "vendor", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-cat-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const [category] = await db.$transaction([db.vendorCategory.delete({ where: { id } })]);

    await logAudit({
      userId: session.user.id,
      action: "vendor_category.delete",
      entityType: "vendor_category",
      entityId: id,
      description: `Deleted vendor category "${category.name}"`,
    });

    revalidateTag("vendors", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteVendorCategory]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Vendor ──────────────────────────────────────────────────────────────────

export async function createVendor(data: unknown) {
  const permResult = await requirePermission({ module: "vendor", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createVendorSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { paymentMethods, ...vendorData } = parsed.data;

  try {
    const [vendor] = await db.$transaction([db.vendor.create({
      data: {
        ...vendorData,
        paymentMethods: paymentMethods?.length
          ? { create: paymentMethods.map((pm) => ({ bankName: pm.bankName, bankAccountNumber: pm.bankAccountNumber, bankRecipient: pm.bankRecipient })) }
          : undefined,
      },
      include: { category: { select: { id: true, name: true } }, paymentMethods: true },
    })]);

    await logAudit({
      userId: session.user.id,
      action: "vendor.create",
      entityType: "vendor",
      entityId: vendor.id,
      description: `Created vendor "${vendor.name}"`,
    });

    revalidateTag("vendors", "max");
    return { success: true, data: vendor };
  } catch (e) {
    console.error("[createVendor]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateVendor(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "vendor", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateVendorSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { paymentMethods, ...vendorData } = parsed.data;

  try {
    // Update vendor + replace payment methods
    await db.$transaction([
      db.vendor.update({ where: { id }, data: vendorData }),
      db.paymentMethod.deleteMany({ where: { vendorId: id } }),
      ...(paymentMethods ?? []).map((pm) =>
        db.paymentMethod.create({ data: { vendorId: id, bankName: pm.bankName, bankAccountNumber: pm.bankAccountNumber, bankRecipient: pm.bankRecipient } })
      ),
    ]);

    const vendor = await db.vendor.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } }, paymentMethods: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "vendor.update",
      entityType: "vendor",
      entityId: id,
      description: `Updated vendor "${vendor?.name}"`,
    });

    revalidateTag("vendors", "max");
    return { success: true, data: vendor };
  } catch (e) {
    console.error("[updateVendor]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteVendor(id: string) {
  const permResult = await requirePermission({ module: "vendor", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`vendor-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const [vendor] = await db.$transaction([db.vendor.delete({ where: { id } })]);

  await logAudit({
    userId: session.user.id,
    action: "vendor.delete",
    entityType: "vendor",
    entityId: id,
    description: `Deleted vendor "${vendor.name}"`,
  });

  return { success: true };
}
