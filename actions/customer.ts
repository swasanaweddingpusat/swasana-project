"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { customerSchema, updateCustomerSchema } from "@/lib/validations/customer";
import { logAudit } from "@/lib/audit";

export async function createCustomer(data: unknown) {
  const { session, error } = await requirePermission({ module: "customers", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`customer-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const { mobileNumber, ...rest } = parsed.data;
    const [customer] = await db.$transaction([db.customer.create({
      data: {
        ...rest,
        mobileNumber: mobileNumber as unknown as Prisma.InputJsonValue,
        nikNumber: rest.nikNumber || null,
        updatedBy: session!.user.name ?? session!.user.email,
      },
    })]);
    await logAudit({
      userId: session!.user.profileId,
      action: "customer.created",
      entityType: "customer",
      entityId: customer.id,
      description: `Customer ${parsed.data.name} ditambahkan`,
      changes: { after: parsed.data },
    });
    revalidateTag("customers", "max");
    return { success: true, customer };
  } catch (e) {
    console.error("[createCustomer]", e);
    return { success: false, error: "Gagal membuat customer." };
  }
}

export async function updateCustomer(data: unknown) {
  const { session, error } = await requirePermission({ module: "customers", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`customer-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateCustomerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, mobileNumber: mn, ...rest } = parsed.data;

  try {
    const [customer] = await db.$transaction([db.customer.update({
      where: { id },
      data: {
        ...rest,
        ...(mn !== undefined && { mobileNumber: mn as unknown as Prisma.InputJsonValue }),
        nikNumber: rest.nikNumber || null,
        updatedBy: session!.user.name ?? session!.user.email,
      },
    })]);
    await logAudit({
      userId: session!.user.profileId,
      action: "customer.updated",
      entityType: "customer",
      entityId: customer.id,
      description: `Customer ${customer.id} diperbarui`,
      changes: { before: { id }, after: rest },
    });
    revalidateTag("customers", "max");
    return { success: true, customer };
  } catch (e) {
    console.error("[updateCustomer]", e);
    return { success: false, error: "Gagal memperbarui customer." };
  }
}

export async function deleteCustomer(id: string) {
  const { session, error } = await requirePermission({ module: "customers", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`customer-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.customer.delete({ where: { id } })]);
    await logAudit({
      userId: session!.user.profileId,
      action: "customer.deleted",
      entityType: "customer",
      entityId: id,
      description: `Customer ${id} dihapus`,
    });
    revalidateTag("customers", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteCustomer]", e);
    return { success: false, error: "Gagal menghapus customer." };
  }
}
