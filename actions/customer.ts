"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { customerSchema, updateCustomerSchema } from "@/lib/validations/customer";

export async function createCustomer(data: unknown) {
  const { session, error } = await requirePermission({ module: "customers", action: "create" });
  if (error) return { success: false, error };

  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const customer = await db.customer.create({
      data: {
        ...parsed.data,
        nikNumber: parsed.data.nikNumber || null,
        updatedBy: session!.user.name ?? session!.user.email,
      },
    });
    revalidateTag("customers", "max");
    return { success: true, customer };
  } catch {
    return { success: false, error: "Gagal membuat customer." };
  }
}

export async function updateCustomer(data: unknown) {
  const { session, error } = await requirePermission({ module: "customers", action: "update" });
  if (error) return { success: false, error };

  const parsed = updateCustomerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, ...rest } = parsed.data;

  try {
    const customer = await db.customer.update({
      where: { id },
      data: {
        ...rest,
        nikNumber: rest.nikNumber || null,
        updatedBy: session!.user.name ?? session!.user.email,
      },
    });
    revalidateTag("customers", "max");
    return { success: true, customer };
  } catch {
    return { success: false, error: "Gagal memperbarui customer." };
  }
}

export async function deleteCustomer(id: string) {
  const { error } = await requirePermission({ module: "customers", action: "delete" });
  if (error) return { success: false, error };

  try {
    await db.customer.delete({ where: { id } });
    revalidateTag("customers", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus customer." };
  }
}
