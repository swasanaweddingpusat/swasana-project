"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createJobPostingSchema, updateJobPostingSchema } from "@/lib/validations/jobPosting";

// ─── Create Job Posting ───────────────────────────────────────────────────────

export async function createJobPosting(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createJobPostingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    // Validate department exists if provided
    if (parsed.data.departmentId) {
      const dept = await db.department.findUnique({ where: { id: parsed.data.departmentId } });
      if (!dept) return { success: false, error: "Departemen tidak ditemukan" };
    }

    // Validate position exists if provided
    if (parsed.data.positionId) {
      const pos = await db.position.findUnique({ where: { id: parsed.data.positionId } });
      if (!pos) return { success: false, error: "Posisi tidak ditemukan" };
    }

    // Ensure salary min <= salary max if both provided
    if (
      parsed.data.salaryRangeMin != null &&
      parsed.data.salaryRangeMax != null &&
      parsed.data.salaryRangeMin > parsed.data.salaryRangeMax
    ) {
      return { success: false, error: "Gaji minimum tidak boleh lebih tinggi dari gaji maksimum" };
    }

    const createData: Record<string, unknown> = {
      title: parsed.data.title,
      description: parsed.data.description || null,
      requirements: parsed.data.requirements || null,
      location: parsed.data.location || null,
      employmentType: parsed.data.employmentType || null,
      salaryRangeMin: parsed.data.salaryRangeMin ?? null,
      salaryRangeMax: parsed.data.salaryRangeMax ?? null,
      departmentId: parsed.data.departmentId || null,
      positionId: parsed.data.positionId || null,
      isWalkInInterview: parsed.data.isWalkInInterview ?? false,
      brandId: parsed.data.brandId || null,
      submissionDate: parsed.data.submissionDate || null,
      interviewDate: parsed.data.interviewDate || null,
      level: parsed.data.level || null,
      quota: parsed.data.quota ?? null,
      interviewLocation: parsed.data.interviewLocation || null,
      startDate: parsed.data.startDate || null,
      minEducation: parsed.data.minEducation || null,
      minExperience: parsed.data.minExperience || null,
      otherQualifications: parsed.data.otherQualifications || null,
      additionalNotes: parsed.data.additionalNotes || null,
      approverId: parsed.data.approverId || null,
      submittedBySignature: parsed.data.submittedBySignature || null,
      createdBy: session!.user.profileId,
    };

    // Only include jobDescriptions if provided (JSON field doesn't accept null)
    if (parsed.data.jobDescriptions) {
      createData.jobDescriptions = parsed.data.jobDescriptions;
    }

    const posting = await db.jobPosting.create({
      data: createData as Parameters<typeof db.jobPosting.create>[0]["data"],
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.create",
      entityType: "job_posting",
      entityId: posting.id,
      description: `Lowongan "${posting.title}" dibuat`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[createJobPosting] Error:", {
      message: errorMessage,
      data: parsed.data,
      timestamp: new Date().toISOString(),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return { success: false, error: "Gagal membuat lowongan. Silakan periksa data Anda." };
  }
}

// ─── Update Job Posting ───────────────────────────────────────────────────────

export async function updateJobPosting(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateJobPostingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    // Build update data object, only including fields that are explicitly provided
    const updateData: Record<string, unknown> = {};

    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.requirements !== undefined) updateData.requirements = parsed.data.requirements;
    if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
    if (parsed.data.employmentType !== undefined) updateData.employmentType = parsed.data.employmentType;
    if (parsed.data.salaryRangeMin !== undefined) updateData.salaryRangeMin = parsed.data.salaryRangeMin;
    if (parsed.data.salaryRangeMax !== undefined) updateData.salaryRangeMax = parsed.data.salaryRangeMax;
    if (parsed.data.departmentId !== undefined) updateData.departmentId = parsed.data.departmentId;
    if (parsed.data.positionId !== undefined) updateData.positionId = parsed.data.positionId;
    if (parsed.data.isWalkInInterview !== undefined) updateData.isWalkInInterview = parsed.data.isWalkInInterview;
    if (parsed.data.brandId !== undefined) updateData.brandId = parsed.data.brandId;
    if (parsed.data.submissionDate !== undefined) updateData.submissionDate = parsed.data.submissionDate;
    if (parsed.data.interviewDate !== undefined) updateData.interviewDate = parsed.data.interviewDate;
    if (parsed.data.level !== undefined) updateData.level = parsed.data.level;
    if (parsed.data.quota !== undefined) updateData.quota = parsed.data.quota;
    if (parsed.data.interviewLocation !== undefined) updateData.interviewLocation = parsed.data.interviewLocation;
    if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate;
    if (parsed.data.minEducation !== undefined) updateData.minEducation = parsed.data.minEducation;
    if (parsed.data.minExperience !== undefined) updateData.minExperience = parsed.data.minExperience;
    if (parsed.data.otherQualifications !== undefined) updateData.otherQualifications = parsed.data.otherQualifications;
    // Only include jobDescriptions if it's not null (JSON field)
    if (parsed.data.jobDescriptions !== undefined && parsed.data.jobDescriptions !== null) {
      updateData.jobDescriptions = parsed.data.jobDescriptions;
    }
    if (parsed.data.additionalNotes !== undefined) updateData.additionalNotes = parsed.data.additionalNotes;
    if (parsed.data.approverId !== undefined) updateData.approverId = parsed.data.approverId;
    if (parsed.data.submittedBySignature !== undefined) updateData.submittedBySignature = parsed.data.submittedBySignature;

    const posting = await db.jobPosting.update({ where: { id }, data: updateData as Parameters<typeof db.jobPosting.update>[0]["data"] });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.update",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" diperbarui`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Job Posting ───────────────────────────────────────────────────────

export async function deleteJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.findUnique({
      where: { id },
      select: { title: true, _count: { select: { candidates: true } } },
    });
    if (!posting) return { success: false, error: "Lowongan tidak ditemukan." };
    if (posting._count.candidates > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus lowongan yang sudah memiliki kandidat.",
      };
    }

    await db.jobPosting.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.delete",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" dihapus`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Publish Job Posting ──────────────────────────────────────────────────────

export async function publishJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-publish:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.update({
      where: { id },
      data: { status: "open", openDate: new Date() },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.publish",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" dipublikasikan`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[publishJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Close Job Posting ────────────────────────────────────────────────────────

export async function closeJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-close:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.update({
      where: { id },
      data: { status: "closed", closeDate: new Date() },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.close",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" ditutup`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[closeJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
