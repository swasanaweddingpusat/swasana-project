"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { generatePayrollSchema } from "@/lib/validations/payrollPeriod";
import { generatePayrollForPeriod } from "@/lib/payroll/payroll-generator";

export async function generatePayroll(data: unknown): Promise<{
  success: boolean;
  error?: string;
  data?: { periodId: string; totalEmployees: number; message: string };
}> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payroll-generate:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = generatePayrollSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const result = await generatePayrollForPeriod(
      parsed.data.month,
      parsed.data.year,
      session!.user.profileId,
    );

    await logAudit({
      userId: session!.user.profileId,
      action: "payroll.generate",
      entityType: "payroll-period",
      entityId: result.periodId,
      description: `Payroll ${parsed.data.month}/${parsed.data.year} di-generate (${result.totalEmployees} karyawan)`,
    });

    revalidateTag("payroll-periods", "max");
    return {
      success: true,
      data: {
        periodId: result.periodId,
        totalEmployees: result.totalEmployees,
        message: `Payroll berhasil di-generate untuk ${result.totalEmployees} karyawan.`,
      },
    };
  } catch (e) {
    console.error("[generatePayroll]", e);
    const errMsg = e instanceof Error ? e.message : "Terjadi kesalahan saat generate payroll.";
    return { success: false, error: errMsg };
  }
}

export async function finalizePayroll(
  periodId: string,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "finalize" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payroll-finalize:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const period = await db.payrollPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, status: true, month: true, year: true },
    });
    if (!period) return { success: false, error: "Periode payroll tidak ditemukan." };
    if (period.status !== "draft") {
      return { success: false, error: "Hanya periode berstatus draft yang bisa difinalisasi." };
    }

    const now = new Date();

    await db.$transaction([
      db.payrollPeriod.update({
        where: { id: periodId },
        data: { status: "finalized", finalizedBy: session!.user.profileId, finalizedAt: now },
      }),
      db.payslip.updateMany({
        where: { payrollPeriodId: periodId },
        data: { status: "finalized" },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "payroll.finalize",
      entityType: "payroll-period",
      entityId: periodId,
      description: `Payroll ${period.month}/${period.year} difinalisasi`,
    });

    revalidateTag("payroll-periods", "max");
    return { success: true };
  } catch (e) {
    console.error("[finalizePayroll]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function markPayrollPaid(
  periodId: string,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "finalize" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payroll-paid:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const period = await db.payrollPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, status: true, month: true, year: true },
    });
    if (!period) return { success: false, error: "Periode payroll tidak ditemukan." };
    if (period.status !== "finalized") {
      return { success: false, error: "Hanya periode berstatus finalized yang bisa ditandai lunas." };
    }

    await db.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "paid", paidAt: new Date() },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "payroll.mark-paid",
      entityType: "payroll-period",
      entityId: periodId,
      description: `Payroll ${period.month}/${period.year} ditandai lunas`,
    });

    revalidateTag("payroll-periods", "max");
    return { success: true };
  } catch (e) {
    console.error("[markPayrollPaid]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePayrollPeriod(
  periodId: string,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payroll-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const period = await db.payrollPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, status: true, month: true, year: true },
    });
    if (!period) return { success: false, error: "Periode payroll tidak ditemukan." };
    if (period.status !== "draft") {
      return { success: false, error: "Hanya periode berstatus draft yang bisa dihapus." };
    }

    await db.payrollPeriod.delete({ where: { id: periodId } });

    await logAudit({
      userId: session!.user.profileId,
      action: "payroll.delete",
      entityType: "payroll-period",
      entityId: periodId,
      description: `Payroll ${period.month}/${period.year} dihapus`,
    });

    revalidateTag("payroll-periods", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePayrollPeriod]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
