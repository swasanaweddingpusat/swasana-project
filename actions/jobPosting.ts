"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requirePermission, isSuperAdmin } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createJobPostingSchema, updateJobPostingSchema } from "@/lib/validations/jobPosting";
import { generateAccessCode } from "@/lib/access-code";


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

    // Validate brand exists if provided
    if (parsed.data.brandId) {
      const brand = await db.brand.findUnique({ where: { id: parsed.data.brandId } });
      if (!brand) return { success: false, error: "Perusahaan tidak ditemukan" };
    }

    // Validate approver1 exists if provided
    if (parsed.data.approverId) {
      const approver = await db.profile.findUnique({ where: { id: parsed.data.approverId } });
      if (!approver) return { success: false, error: "Penyetuju 1 tidak ditemukan" };
    }

    // Validate approver2 exists if provided
    if (parsed.data.approver2Id) {
      const approver2 = await db.profile.findUnique({ where: { id: parsed.data.approver2Id } });
      if (!approver2) return { success: false, error: "Penyetuju 2 tidak ditemukan" };
    }

    // Validate interview venue exists if provided
    if (parsed.data.interviewVenueId) {
      const venue = await db.venue.findUnique({ where: { id: parsed.data.interviewVenueId } });
      if (!venue) return { success: false, error: "Venue tidak ditemukan" };
    }

    // Ensure salary min <= salary max if both provided
    if (
      parsed.data.salaryRangeMin != null &&
      parsed.data.salaryRangeMax != null &&
      parsed.data.salaryRangeMin > parsed.data.salaryRangeMax
    ) {
      return { success: false, error: "Gaji minimum tidak boleh lebih tinggi dari gaji maksimum" };
    }

    const posting = await db.jobPosting.create({
      data: {
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
        submissionDate: parsed.data.submissionDate ?? null,
        interviewDate: parsed.data.interviewDate ?? null,
        level: parsed.data.level || null,
        quota: parsed.data.quota ?? null,
        interviewLocation: parsed.data.interviewLocation || null,
        startDate: parsed.data.startDate ?? null,
        minEducation: parsed.data.minEducation || null,
        minExperience: parsed.data.minExperience || null,
        otherQualifications: parsed.data.otherQualifications || null,
        jobDescriptions: parsed.data.jobDescriptions
          ? (parsed.data.jobDescriptions as Prisma.InputJsonValue)
          : Prisma.DbNull,
        additionalNotes: parsed.data.additionalNotes || null,
        approverId: parsed.data.approverId || null,
        approver2Id: parsed.data.approver2Id || null,
        submittedBySignature: parsed.data.submittedBySignature || null,
        companyName: parsed.data.companyName || null,
        interviewLink: parsed.data.interviewLink || null,
        interviewVenueId: parsed.data.interviewVenueId || null,
        createdBy: session!.user.profileId,
      },
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
      title: parsed.data.title,
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
    const existing = await db.jobPosting.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, createdBy: true },
    });
    if (!existing) return { success: false, error: "Lowongan tidak ditemukan." };

    if (existing.status === "open") {
      const isCreator = existing.createdBy === session!.user.profileId;
      const isAdmin = await isSuperAdmin(session!.user.roleId);
      if (!isCreator && !isAdmin) {
        return { success: false, error: "Hanya pengaju atau super admin yang dapat mengedit lowongan yang sudah dipublikasikan." };
      }
    }

    // Build update data object, only including fields that are explicitly provided
    const updateData: Prisma.JobPostingUncheckedUpdateInput = {};

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
    if (parsed.data.jobDescriptions !== undefined) {
      updateData.jobDescriptions = parsed.data.jobDescriptions
        ? (parsed.data.jobDescriptions as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }
    if (parsed.data.additionalNotes !== undefined) updateData.additionalNotes = parsed.data.additionalNotes;
    if (parsed.data.approverId !== undefined) updateData.approverId = parsed.data.approverId;
    if (parsed.data.approver2Id !== undefined) updateData.approver2Id = parsed.data.approver2Id;
    if (parsed.data.submittedBySignature !== undefined) updateData.submittedBySignature = parsed.data.submittedBySignature;
    if (parsed.data.companyName !== undefined) updateData.companyName = parsed.data.companyName;
    if (parsed.data.interviewLink !== undefined) updateData.interviewLink = parsed.data.interviewLink;
    if (parsed.data.interviewVenueId !== undefined) updateData.interviewVenueId = parsed.data.interviewVenueId;

    const posting = await db.jobPosting.update({ where: { id }, data: updateData });

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
    const posting = await db.jobPosting.findFirst({
      where: { id, deletedAt: null },
      select: { title: true },
    });
    if (!posting) return { success: false, error: "Lowongan tidak ditemukan." };

    await db.jobPosting.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.delete",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" dihapus (soft)`,
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
    const existing = await db.jobPosting.findUnique({
      where: { id },
      select: { approvalStatus: true, approvalStatus2: true, publicToken: true },
    });
    if (!existing) return { success: false, error: "Lowongan tidak ditemukan." };
    if (existing.approvalStatus !== "approved" || existing.approvalStatus2 !== "approved") {
      return { success: false, error: "Lowongan harus disetujui oleh kedua penyetuju sebelum dipublikasikan." };
    }

    // Keep the existing publicToken stable across republish/reopen so links already
    // distributed to candidates don't break — only mint one the first time.
    let publicToken = existing.publicToken;
    if (!publicToken) {
      const { randomBytes } = await import("crypto");
      publicToken = randomBytes(32).toString("hex");
    }

    const posting = await db.jobPosting.update({
      where: { id },
      data: { status: "open", openDate: new Date(), publicToken },
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

// ─── Generate/Regenerate Public Access Code ──────────────────────────────────
// One shared 6-char code per JobPosting, gating the public /apply/[token] form.
// Lazy: generated on-demand the first time HR opens the "Link Pendaftaran"
// popup, and re-runnable via "Regenerate Kode" (rotates the code only —
// publicToken/link stays stable so it doesn't need to be redistributed).

export async function generateJobPostingAccessCode(
  id: string
): Promise<{ success: boolean; error?: string; data?: { accessCode: string } }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-access-code:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.jobPosting.findFirst({ where: { id, deletedAt: null }, select: { title: true } });
    if (!existing) return { success: false, error: "Lowongan tidak ditemukan." };

    const accessCode = generateAccessCode();
    await db.jobPosting.update({ where: { id }, data: { publicAccessCode: accessCode } });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.access_code_generated",
      entityType: "job_posting",
      entityId: id,
      description: `Kode akses form lamaran untuk "${existing.title}" di-generate ulang`,
    });

    revalidateTag("job-postings", "max");
    return { success: true, data: { accessCode } };
  } catch (e) {
    console.error("[generateJobPostingAccessCode]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Approve Job Posting ──────────────────────────────────────────────────────

export async function approveJobPosting(
  id: string,
  note?: string | null
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-approve:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.findUnique({
      where: { id },
      select: {
        title: true,
        approverId: true,
        approver2Id: true,
        approvalStatus: true,
        approvalStatus2: true,
        createdBy: true,
      },
    });
    if (!posting) return { success: false, error: "Lowongan tidak ditemukan." };

    const profileId = session!.user.profileId;
    const isAdmin = await isSuperAdmin(session!.user.roleId);
    const isApprover1 = posting.approverId === profileId;
    const isApprover2 = posting.approver2Id === profileId;

    // Determine which slot this user can act on
    let targetSlot: 1 | 2 | null = null;
    if (isApprover1 && posting.approvalStatus === "pending") {
      targetSlot = 1;
    } else if (isApprover2 && posting.approvalStatus2 === "pending") {
      if (posting.approvalStatus !== "approved") {
        return { success: false, error: "Menunggu persetujuan penyetuju pertama." };
      }
      targetSlot = 2;
    } else if (isAdmin && !isApprover1 && !isApprover2) {
      // Super-admin fills next pending slot
      if (posting.approvalStatus === "pending") {
        targetSlot = 1;
      } else if (posting.approvalStatus2 === "pending") {
        targetSlot = 2;
      }
    }

    if (!targetSlot) {
      return { success: false, error: "Anda tidak berhak menyetujui lowongan ini atau lowongan sudah diproses." };
    }

    const now = new Date();
    const updateData =
      targetSlot === 1
        ? { approvalStatus: "approved" as const, approvedById: profileId, approvedAt: now, approvalNote: note?.trim() || null }
        : { approvalStatus2: "approved" as const, approvedBy2Id: profileId, approvedAt2: now, approvalNote2: note?.trim() || null };

    await db.jobPosting.update({ where: { id }, data: updateData });

    const isFinalApproval = targetSlot === 2 || (targetSlot === 1 && posting.approvalStatus2 === "approved");
    const notifMessage = isFinalApproval
      ? `Lowongan "${posting.title}" telah disetujui oleh kedua penyetuju dan siap dipublikasikan`
      : `Lowongan "${posting.title}" disetujui penyetuju ${targetSlot}. Menunggu persetujuan penyetuju berikutnya.`;

    if (posting.createdBy) {
      await db.notification.create({
        data: {
          userId: posting.createdBy,
          title: isFinalApproval ? "Lowongan Disetujui" : `Lowongan Disetujui Penyetuju ${targetSlot}`,
          message: notifMessage,
          type: "approval_approved",
          entityType: "job_posting",
          entityId: id,
        },
      });
    }

    await logAudit({
      userId: profileId,
      action: "job_posting.approve",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" disetujui (slot ${targetSlot})`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[approveJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Reject Job Posting ───────────────────────────────────────────────────────

export async function rejectJobPosting(
  id: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-reject:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!note?.trim()) return { success: false, error: "Alasan penolakan wajib diisi." };

  try {
    const posting = await db.jobPosting.findUnique({
      where: { id },
      select: {
        title: true,
        approverId: true,
        approver2Id: true,
        approvalStatus: true,
        approvalStatus2: true,
        createdBy: true,
      },
    });
    if (!posting) return { success: false, error: "Lowongan tidak ditemukan." };

    const profileId = session!.user.profileId;
    const isAdmin = await isSuperAdmin(session!.user.roleId);
    const isApprover1 = posting.approverId === profileId;
    const isApprover2 = posting.approver2Id === profileId;

    let targetSlot: 1 | 2 | null = null;
    if (isApprover1 && posting.approvalStatus === "pending") {
      targetSlot = 1;
    } else if (isApprover2 && posting.approvalStatus2 === "pending") {
      if (posting.approvalStatus !== "approved") {
        return { success: false, error: "Menunggu persetujuan penyetuju pertama." };
      }
      targetSlot = 2;
    } else if (isAdmin && !isApprover1 && !isApprover2) {
      if (posting.approvalStatus === "pending") {
        targetSlot = 1;
      } else if (posting.approvalStatus2 === "pending") {
        targetSlot = 2;
      }
    }

    if (!targetSlot) {
      return { success: false, error: "Anda tidak berhak menolak lowongan ini atau lowongan sudah diproses." };
    }

    const now = new Date();
    const updateData =
      targetSlot === 1
        ? { approvalStatus: "rejected" as const, approvedById: profileId, approvedAt: now, approvalNote: note.trim() }
        : { approvalStatus2: "rejected" as const, approvedBy2Id: profileId, approvedAt2: now, approvalNote2: note.trim() };

    await db.jobPosting.update({ where: { id }, data: updateData });

    if (posting.createdBy) {
      await db.notification.create({
        data: {
          userId: posting.createdBy,
          title: "Lowongan Ditolak",
          message: `Lowongan "${posting.title}" ditolak oleh ${session!.user.name ?? "penyetuju"} (penyetuju ${targetSlot}): ${note.trim()}`,
          type: "approval_update",
          entityType: "job_posting",
          entityId: id,
        },
      });
    }

    await logAudit({
      userId: profileId,
      action: "job_posting.reject",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" ditolak (slot ${targetSlot}): ${note.trim()}`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[rejectJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Resubmit Job Posting ─────────────────────────────────────────────────────

export async function resubmitJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-resubmit:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.findUnique({
      where: { id },
      select: { title: true, approvalStatus: true },
    });
    if (!posting) return { success: false, error: "Lowongan tidak ditemukan." };
    if (posting.approvalStatus !== "rejected") {
      return { success: false, error: "Hanya lowongan yang ditolak yang bisa diajukan ulang." };
    }

    await db.jobPosting.update({
      where: { id },
      data: {
        approvalStatus: "pending",
        approvedById: null,
        approvedAt: null,
        approvalNote: null,
        approvalStatus2: "pending",
        approvedBy2Id: null,
        approvedAt2: null,
        approvalNote2: null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.resubmit",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" diajukan ulang`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[resubmitJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
