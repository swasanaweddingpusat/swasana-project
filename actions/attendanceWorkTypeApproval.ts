"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { approveWorkTypeSchema, rejectWorkTypeSchema } from "@/lib/validations/attendanceWorkTypeApproval";

export async function managerApproveWorkType(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`attendance-work-type-mgr-approve:${session.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = approveWorkTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const callerProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: { status: true },
    });
    if (!callerProfile || callerProfile.status !== "active") {
      return { success: false, error: "Akun Anda tidak aktif." };
    }

    const attendance = await db.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      select: { id: true, workTypeApprovalStatus: true, workTypeApproverId: true },
    });
    if (!attendance) return { success: false, error: "Data absensi tidak ditemukan." };
    if (attendance.workTypeApprovalStatus !== "pending") {
      return { success: false, error: "Pengajuan sudah diproses." };
    }
    if (attendance.workTypeApproverId !== profileId) {
      return { success: false, error: "Anda bukan manager dari karyawan ini." };
    }

    await db.attendance.update({
      where: { id: attendance.id },
      data: {
        workTypeApprovalStatus: "manager_approved",
        workTypeManagerApprovedBy: profileId,
        workTypeManagerApprovedAt: new Date(),
        workTypeManagerNote: parsed.data.note ?? null,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance.work_type_manager_approve",
      entityType: "Attendance",
      entityId: attendance.id,
      description: "Manager menyetujui tipe kerja WFH/WFA",
    });

    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[managerApproveWorkType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function managerRejectWorkType(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`attendance-work-type-mgr-reject:${session.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = rejectWorkTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const callerProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: { status: true },
    });
    if (!callerProfile || callerProfile.status !== "active") {
      return { success: false, error: "Akun Anda tidak aktif." };
    }

    const attendance = await db.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      select: { id: true, workTypeApprovalStatus: true, workTypeApproverId: true },
    });
    if (!attendance) return { success: false, error: "Data absensi tidak ditemukan." };
    if (attendance.workTypeApprovalStatus !== "pending") {
      return { success: false, error: "Pengajuan sudah diproses." };
    }
    if (attendance.workTypeApproverId !== profileId) {
      return { success: false, error: "Anda bukan manager dari karyawan ini." };
    }

    // Manager reject langsung terminal — nulis ke field HR/terminal (workTypeApprovedBy/At/ReviewNote),
    // bukan field manager, persis pola managerRejectAttendanceCorrection.
    await db.attendance.update({
      where: { id: attendance.id },
      data: {
        workTypeApprovalStatus: "rejected",
        workTypeApprovedBy: profileId,
        workTypeApprovedAt: new Date(),
        workTypeReviewNote: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance.work_type_manager_reject",
      entityType: "Attendance",
      entityId: attendance.id,
      description: `Manager menolak tipe kerja WFH/WFA: ${parsed.data.reason}`,
    });

    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[managerRejectWorkType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function approveWorkType(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-work-type-approve:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = approveWorkTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const attendance = await db.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      select: { id: true, workTypeApprovalStatus: true, workTypeApproverId: true },
    });
    if (!attendance) return { success: false, error: "Data absensi tidak ditemukan." };
    const hrCanActDirectly = attendance.workTypeApprovalStatus === "pending" && attendance.workTypeApproverId === null;
    if (attendance.workTypeApprovalStatus !== "manager_approved" && !hrCanActDirectly) {
      return { success: false, error: "Pengajuan belum disetujui manager." };
    }

    await db.attendance.update({
      where: { id: attendance.id },
      data: {
        workTypeApprovalStatus: "approved",
        workTypeApprovedBy: session!.user.profileId,
        workTypeApprovedAt: new Date(),
        workTypeReviewNote: parsed.data.note ?? null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance.work_type_approve",
      entityType: "Attendance",
      entityId: attendance.id,
      description: "HR menyetujui tipe kerja WFH/WFA",
    });

    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[approveWorkType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function rejectWorkType(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-work-type-reject:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = rejectWorkTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const attendance = await db.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      select: { id: true, workTypeApprovalStatus: true, workTypeApproverId: true },
    });
    if (!attendance) return { success: false, error: "Data absensi tidak ditemukan." };
    const hrCanActDirectly = attendance.workTypeApprovalStatus === "pending" && attendance.workTypeApproverId === null;
    if (attendance.workTypeApprovalStatus !== "manager_approved" && !hrCanActDirectly) {
      return { success: false, error: "Pengajuan belum disetujui manager." };
    }

    // Reject cuma menandai status — Attendance.status (on_time/late) TIDAK diubah,
    // karyawan tetap dapat kredit hadir. Murni flag audit/administratif.
    await db.attendance.update({
      where: { id: attendance.id },
      data: {
        workTypeApprovalStatus: "rejected",
        workTypeApprovedBy: session!.user.profileId,
        workTypeApprovedAt: new Date(),
        workTypeReviewNote: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance.work_type_reject",
      entityType: "Attendance",
      entityId: attendance.id,
      description: `HR menolak tipe kerja WFH/WFA: ${parsed.data.reason}`,
    });

    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[rejectWorkType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
