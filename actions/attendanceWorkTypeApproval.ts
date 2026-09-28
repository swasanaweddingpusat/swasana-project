"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { approveWorkTypeSchema, rejectWorkTypeSchema } from "@/lib/validations/attendanceWorkTypeApproval";

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
      select: { id: true, workTypeApprovalStatus: true },
    });
    if (!attendance) return { success: false, error: "Data absensi tidak ditemukan." };
    if (attendance.workTypeApprovalStatus !== "pending") {
      return { success: false, error: "Pengajuan sudah diproses." };
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
      select: { id: true, workTypeApprovalStatus: true },
    });
    if (!attendance) return { success: false, error: "Data absensi tidak ditemukan." };
    if (attendance.workTypeApprovalStatus !== "pending") {
      return { success: false, error: "Pengajuan sudah diproses." };
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
