"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createSalaryComponentSchema,
  updateSalaryComponentSchema,
} from "@/lib/validations/salaryComponent";

export async function createSalaryComponent(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`salary-component-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createSalaryComponentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const component = await db.salaryComponent.create({ data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "salary-component.create",
      entityType: "salary-component",
      entityId: component.id,
      description: `Komponen gaji "${component.name}" dibuat`,
    });

    revalidateTag("salary-components", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama atau kode komponen gaji sudah digunakan." };
    }
    console.error("[createSalaryComponent]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateSalaryComponent(
  id: string,
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`salary-component-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateSalaryComponentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const component = await db.salaryComponent.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "salary-component.update",
      entityType: "salary-component",
      entityId: id,
      description: `Komponen gaji "${component.name}" diperbarui`,
    });

    revalidateTag("salary-components", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama atau kode komponen gaji sudah digunakan." };
    }
    console.error("[updateSalaryComponent]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteSalaryComponent(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`salary-component-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const component = await db.salaryComponent.findUnique({
      where: { id },
      select: { name: true, isSystemType: true },
    });
    if (!component) return { success: false, error: "Komponen gaji tidak ditemukan." };
    if (component.isSystemType) {
      return { success: false, error: "Komponen sistem tidak bisa dihapus." };
    }

    await db.salaryComponent.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "salary-component.delete",
      entityType: "salary-component",
      entityId: id,
      description: `Komponen gaji "${component.name}" dihapus`,
    });

    revalidateTag("salary-components", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteSalaryComponent]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
