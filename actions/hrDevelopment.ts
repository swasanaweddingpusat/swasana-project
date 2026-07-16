"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createTrainingProgramSchema,
  updateTrainingProgramSchema,
  createEmployeeDevelopmentSchema,
  updateEmployeeDevelopmentSchema,
  createEmployeeCertificationSchema,
  updateEmployeeCertificationSchema,
} from "@/lib/validations/hrDevelopment";

// ─── Training Program ─────────────────────────────────────────────────────────

export async function createTrainingProgram(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-training-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createTrainingProgramSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const record = await db.trainingProgram.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.status,
        participantsCount: parsed.data.participantsCount,
        completionPercentage: parsed.data.completionPercentage,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "training_program.create",
      entityType: "training_program",
      entityId: record.id,
      description: `Program pelatihan "${record.name}" dibuat`,
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[createTrainingProgram]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateTrainingProgram(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-training-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateTrainingProgramSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.trainingProgram.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "training_program.update",
      entityType: "training_program",
      entityId: id,
      description: "Program pelatihan diperbarui",
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateTrainingProgram]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteTrainingProgram(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-training-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const record = await db.trainingProgram.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!record) return { success: false, error: "Program pelatihan tidak ditemukan." };

    await db.trainingProgram.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "training_program.delete",
      entityType: "training_program",
      entityId: id,
      description: `Program pelatihan "${record.name}" dihapus`,
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteTrainingProgram]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Employee Development ─────────────────────────────────────────────────────

export async function createEmployeeDevelopment(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-dev-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createEmployeeDevelopmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const record = await db.employeeDevelopment.create({
      data: {
        profileId: parsed.data.profileId,
        skill: parsed.data.skill,
        level: parsed.data.level,
        startDate: parsed.data.startDate,
        targetCompletionDate: parsed.data.targetCompletionDate ?? null,
        progressPercentage: parsed.data.progressPercentage,
        notes: parsed.data.notes ?? null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee_development.create",
      entityType: "employee_development",
      entityId: record.id,
      description: `Pengembangan karyawan "${record.skill}" dibuat`,
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[createEmployeeDevelopment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateEmployeeDevelopment(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-dev-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateEmployeeDevelopmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.employeeDevelopment.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee_development.update",
      entityType: "employee_development",
      entityId: id,
      description: "Pengembangan karyawan diperbarui",
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateEmployeeDevelopment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteEmployeeDevelopment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-dev-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.employeeDevelopment.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee_development.delete",
      entityType: "employee_development",
      entityId: id,
      description: "Pengembangan karyawan dihapus",
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployeeDevelopment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Employee Certification ───────────────────────────────────────────────────

export async function createEmployeeCertification(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-cert-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createEmployeeCertificationSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const record = await db.employeeCertification.create({
      data: {
        profileId: parsed.data.profileId,
        certificationName: parsed.data.certificationName,
        issueDate: parsed.data.issueDate,
        expiryDate: parsed.data.expiryDate ?? null,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee_certification.create",
      entityType: "employee_certification",
      entityId: record.id,
      description: `Sertifikasi "${record.certificationName}" dibuat`,
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[createEmployeeCertification]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateEmployeeCertification(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-cert-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateEmployeeCertificationSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.employeeCertification.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee_certification.update",
      entityType: "employee_certification",
      entityId: id,
      description: "Sertifikasi karyawan diperbarui",
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateEmployeeCertification]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteEmployeeCertification(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`hr-cert-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.employeeCertification.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee_certification.delete",
      entityType: "employee_certification",
      entityId: id,
      description: "Sertifikasi karyawan dihapus",
    });

    revalidateTag("hr-development", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployeeCertification]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
