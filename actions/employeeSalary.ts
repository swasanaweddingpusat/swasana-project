"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  setEmployeeSalarySchema,
  bulkSetEmployeeSalarySchema,
} from "@/lib/validations/employeeSalary";

export async function setEmployeeSalary(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`employee-salary-set:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = setEmployeeSalarySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { profileId, salaryComponentId, amount, effectiveDate, endDate } = parsed.data;

  try {
    const existing = await db.employeeSalary.findFirst({
      where: { profileId, salaryComponentId, effectiveDate },
      select: { id: true },
    });

    let recordId: string;

    if (existing) {
      const updated = await db.employeeSalary.update({
        where: { id: existing.id },
        data: { amount, endDate: endDate ?? null },
      });
      recordId = updated.id;
    } else {
      const created = await db.employeeSalary.create({
        data: { profileId, salaryComponentId, amount, effectiveDate, endDate: endDate ?? null },
      });
      recordId = created.id;
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "employee-salary.set",
      entityType: "employee-salary",
      entityId: recordId,
      description: `Gaji karyawan diatur untuk profileId ${profileId}`,
    });

    revalidateTag("employee-salaries", "max");
    return { success: true };
  } catch (e) {
    console.error("[setEmployeeSalary]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function bulkSetEmployeeSalary(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`employee-salary-bulk:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = bulkSetEmployeeSalarySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { profileIds, salaryComponentId, amount, effectiveDate, endDate } = parsed.data;

  try {
    // Upsert each employee's salary in a single transaction (array form)
    await db.$transaction(
      profileIds.map((profileId) =>
        db.employeeSalary.upsert({
          where: {
            profileId_salaryComponentId_effectiveDate: {
              profileId,
              salaryComponentId,
              effectiveDate,
            },
          },
          update: { amount, endDate: endDate ?? null },
          create: {
            profileId,
            salaryComponentId,
            amount,
            effectiveDate,
            endDate: endDate ?? null,
          },
        }),
      ),
    );

    await logAudit({
      userId: session!.user.profileId,
      action: "employee-salary.bulk-set",
      entityType: "employee-salary",
      entityId: salaryComponentId,
      description: `Gaji massal diatur untuk ${profileIds.length} karyawan`,
    });

    revalidateTag("employee-salaries", "max");
    return { success: true };
  } catch (e) {
    console.error("[bulkSetEmployeeSalary]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteEmployeeSalary(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`employee-salary-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const record = await db.employeeSalary.findUnique({
      where: { id },
      select: { profileId: true },
    });
    if (!record) return { success: false, error: "Data gaji tidak ditemukan." };

    await db.employeeSalary.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee-salary.delete",
      entityType: "employee-salary",
      entityId: id,
      description: `Data gaji karyawan dihapus`,
    });

    revalidateTag("employee-salaries", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployeeSalary]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
