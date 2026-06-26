"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createOnboardingTemplateSchema,
  updateOnboardingTemplateSchema,
  addOnboardingTemplateTaskSchema,
  updateOnboardingTemplateTaskSchema,
  assignOnboardingSchema,
} from "@/lib/validations/onboarding";

// ─── Create Onboarding Template ───────────────────────────────────────────────

export async function createOnboardingTemplate(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-tmpl-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createOnboardingTemplateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    // Clear other defaults BEFORE creating the new one to avoid a window
    // where two templates are simultaneously marked as default.
    if (parsed.data.isDefault) {
      await db.onboardingTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await db.onboardingTemplate.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        isDefault: parsed.data.isDefault,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_template.create",
      entityType: "onboarding_template",
      entityId: template.id,
      description: `Template onboarding "${template.name}" dibuat`,
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama template sudah digunakan." };
    }
    console.error("[createOnboardingTemplate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Onboarding Template ───────────────────────────────────────────────

export async function updateOnboardingTemplate(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-tmpl-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateOnboardingTemplateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    // If setting as default, unset other defaults first
    if (parsed.data.isDefault) {
      await db.$transaction([
        db.onboardingTemplate.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        }),
        db.onboardingTemplate.update({ where: { id }, data: parsed.data }),
      ]);
    } else {
      await db.onboardingTemplate.update({ where: { id }, data: parsed.data });
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_template.update",
      entityType: "onboarding_template",
      entityId: id,
      description: "Template onboarding diperbarui",
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama template sudah digunakan." };
    }
    console.error("[updateOnboardingTemplate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Onboarding Template ───────────────────────────────────────────────

export async function deleteOnboardingTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-tmpl-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const template = await db.onboardingTemplate.findUnique({
      where: { id },
      select: {
        name: true,
        _count: { select: { assignments: true } },
      },
    });
    if (!template) return { success: false, error: "Template tidak ditemukan." };

    const activeCount = await db.onboardingAssignment.count({
      where: { templateId: id, status: "in_progress" },
    });
    if (activeCount > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus template yang memiliki penugasan aktif.",
      };
    }

    await db.onboardingTemplate.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_template.delete",
      entityType: "onboarding_template",
      entityId: id,
      description: `Template onboarding "${template.name}" dihapus`,
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteOnboardingTemplate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Onboarding Template Task ─────────────────────────────────────────────

export async function addOnboardingTemplateTask(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-task-add:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addOnboardingTemplateTaskSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const task = await db.onboardingTemplateTask.create({
      data: {
        templateId: parsed.data.templateId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        dueInDays: parsed.data.dueInDays,
        assignTo: parsed.data.assignTo,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_template_task.create",
      entityType: "onboarding_template_task",
      entityId: task.id,
      description: `Task "${task.title}" ditambahkan ke template`,
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    console.error("[addOnboardingTemplateTask]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Onboarding Template Task ─────────────────────────────────────────

export async function updateOnboardingTemplateTask(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-task-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateOnboardingTemplateTaskSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.onboardingTemplateTask.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_template_task.update",
      entityType: "onboarding_template_task",
      entityId: id,
      description: "Task template onboarding diperbarui",
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateOnboardingTemplateTask]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Onboarding Template Task ─────────────────────────────────────────

export async function deleteOnboardingTemplateTask(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-task-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.onboardingTemplateTask.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_template_task.delete",
      entityType: "onboarding_template_task",
      entityId: id,
      description: "Task template onboarding dihapus",
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteOnboardingTemplateTask]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Assign Onboarding ────────────────────────────────────────────────────────

export async function assignOnboarding(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-assign:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = assignOnboardingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const template = await db.onboardingTemplate.findUnique({
      where: { id: parsed.data.templateId },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) return { success: false, error: "Template tidak ditemukan." };

    const startDate = new Date();
    const assignment = await db.onboardingAssignment.create({
      data: {
        profileId: parsed.data.profileId,
        templateId: parsed.data.templateId,
        startDate,
        status: "in_progress",
      },
    });

    if (template.tasks.length > 0) {
      await db.$transaction(
        template.tasks.map((task) => {
          const dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + task.dueInDays);
          return db.onboardingTask.create({
            data: {
              assignmentId: assignment.id,
              templateTaskId: task.id,
              title: task.title,
              description: task.description ?? null,
              dueDate,
              assignTo: task.assignTo,
              sortOrder: task.sortOrder,
            },
          });
        })
      );
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding.assign",
      entityType: "onboarding_assignment",
      entityId: assignment.id,
      description: `Onboarding template "${template.name}" ditugaskan`,
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Karyawan sudah memiliki penugasan onboarding dengan template ini." };
    }
    console.error("[assignOnboarding]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Complete Onboarding Task ─────────────────────────────────────────────────

export async function completeOnboardingTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`onboarding-task-complete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const now = new Date();

    // Mark task as completed
    const task = await db.onboardingTask.update({
      where: { id: taskId },
      data: {
        isCompleted: true,
        completedAt: now,
        completedBy: session!.user.profileId,
      },
      select: { assignmentId: true },
    });

    // Check if all tasks in this assignment are done
    const remainingCount = await db.onboardingTask.count({
      where: { assignmentId: task.assignmentId, isCompleted: false },
    });

    if (remainingCount === 0) {
      await db.onboardingAssignment.update({
        where: { id: task.assignmentId },
        data: { status: "completed", completedAt: now },
      });
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_task.complete",
      entityType: "onboarding_task",
      entityId: taskId,
      description: "Task onboarding diselesaikan",
    });

    revalidateTag("onboarding", "max");
    return { success: true };
  } catch (e) {
    console.error("[completeOnboardingTask]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
