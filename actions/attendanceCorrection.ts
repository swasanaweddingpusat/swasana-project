"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  submitAttendanceCorrectionSchema,
  approveAttendanceCorrectionSchema,
  rejectAttendanceCorrectionSchema,
  cancelAttendanceCorrectionSchema,
} from "@/lib/validations/attendanceCorrection";
import { determineStatus } from "@/lib/attendance-helpers";
import { uploadToStorage, randomId12 } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";
import type { FileDescriptor } from "@/lib/validations/common";
import type { Prisma } from "@prisma/client";

export async function submitAttendanceCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "attendance", action: "view" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-correction-submit:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = submitAttendanceCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session!.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const existing = await db.attendanceCorrection.findFirst({
      where: { profileId, date: parsed.data.date, status: "pending" },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Sudah ada pengajuan koreksi yang masih pending untuk tanggal ini." };
    }

    if (parsed.data.workShiftId) {
      const shift = await db.workShift.findUnique({
        where: { id: parsed.data.workShiftId },
        select: { isActive: true },
      });
      if (!shift || !shift.isActive) return { success: false, error: "Shift tidak ditemukan atau tidak aktif." };
    }
    if (parsed.data.workLocationId) {
      const location = await db.workLocation.findUnique({
        where: { id: parsed.data.workLocationId },
        select: { isActive: true },
      });
      if (!location || !location.isActive) {
        return { success: false, error: "Lokasi kerja tidak ditemukan atau tidak aktif." };
      }
    }

    // Upload evidence — SOP: random-id filename, webp, 50% quality, JSON descriptor.
    const dateStr = parsed.data.date.toISOString().slice(0, 10);
    const base64Data = parsed.data.photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const rawBuffer = Buffer.from(base64Data, "base64");

    let evidence: FileDescriptor;
    try {
      const compressed = await compressToWebp(rawBuffer);
      const id = randomId12();
      const path = `attendance-corrections/${id}.webp`;
      await uploadToStorage(compressed, path, "image/webp");
      evidence = { id, name_file_origin: `koreksi-absen-${dateStr}.jpg`, mimetype: "image/webp", path };
    } catch (err) {
      console.error("[submitAttendanceCorrection] upload error:", err);
      return { success: false, error: "Gagal mengupload bukti." };
    }

    const correction = await db.attendanceCorrection.create({
      data: {
        profileId,
        date: parsed.data.date,
        type: parsed.data.type,
        requestedClockInAt: parsed.data.requestedClockInAt ?? null,
        requestedClockOutAt: parsed.data.requestedClockOutAt ?? null,
        workShiftId: parsed.data.workShiftId ?? null,
        workLocationId: parsed.data.workLocationId ?? null,
        workType: parsed.data.workType ?? null,
        reason: parsed.data.reason,
        evidence: evidence as Prisma.InputJsonValue,
        status: "pending",
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance_correction.submit",
      entityType: "attendance_correction",
      entityId: correction.id,
      description: `Pengajuan koreksi absen (${parsed.data.type}) untuk ${dateStr}`,
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[submitAttendanceCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function hrApproveAttendanceCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-correction-hr-approve:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = approveAttendanceCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const correction = await db.attendanceCorrection.findUnique({ where: { id: parsed.data.requestId } });
    if (!correction) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (correction.status !== "pending") return { success: false, error: "Pengajuan sudah diproses." };

    const touchesClockIn = correction.type === "CLOCK_IN" || correction.type === "BOTH";
    const touchesClockOut = correction.type === "CLOCK_OUT" || correction.type === "BOTH";

    const existingAttendance = await db.attendance.findUnique({
      where: { profileId_date: { profileId: correction.profileId, date: correction.date } },
      select: { id: true },
    });
    if (!existingAttendance && touchesClockOut && !touchesClockIn) {
      return {
        success: false,
        error: "Belum ada data absensi untuk tanggal ini — tidak bisa koreksi clock-out saja.",
      };
    }

    const evidence = (correction.evidence ?? undefined) as Prisma.InputJsonValue | undefined;

    let clockInData: {
      clockInAt: Date;
      clockInEvidence: Prisma.InputJsonValue | undefined;
      status: "on_time" | "late";
      workShiftId: string;
      workLocationId: string | null;
      workType: "WFO" | "WFH" | "WFA" | null;
      attendantType: "WORKDAY";
      isPublicHoliday: false;
      publicHolidayId: null;
      publicHolidayName: null;
    } | null = null;

    if (touchesClockIn) {
      const requestedClockInAt = correction.requestedClockInAt;
      const workShiftId = correction.workShiftId;
      if (!requestedClockInAt || !workShiftId) {
        return { success: false, error: "Data koreksi clock-in tidak lengkap." };
      }
      const workShift = await db.workShift.findUnique({
        where: { id: workShiftId },
        select: { startTime: true, lateToleranceMinutes: true, isOvernight: true },
      });
      if (!workShift) return { success: false, error: "Shift tidak ditemukan." };

      clockInData = {
        clockInAt: requestedClockInAt,
        clockInEvidence: evidence,
        status: determineStatus(requestedClockInAt, workShift.startTime, workShift.lateToleranceMinutes, workShift.isOvernight),
        workShiftId,
        workLocationId: correction.workLocationId,
        workType: correction.workType,
        attendantType: "WORKDAY",
        isPublicHoliday: false,
        publicHolidayId: null,
        publicHolidayName: null,
      };
    }

    let clockOutData: { clockOutAt: Date; clockOutEvidence: Prisma.InputJsonValue | undefined } | null = null;

    if (touchesClockOut) {
      const requestedClockOutAt = correction.requestedClockOutAt;
      if (!requestedClockOutAt) {
        return { success: false, error: "Data koreksi clock-out tidak lengkap." };
      }
      clockOutData = { clockOutAt: requestedClockOutAt, clockOutEvidence: evidence };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.attendance.upsert({
        where: { profileId_date: { profileId: correction.profileId, date: correction.date } },
        create: {
          profileId: correction.profileId,
          date: correction.date,
          ...clockInData,
          ...clockOutData,
        },
        update: {
          ...clockInData,
          ...clockOutData,
        },
      }),
      db.attendanceCorrection.update({
        where: { id: correction.id },
        data: {
          status: "approved",
          reviewedBy: session!.user.profileId,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note ?? null,
        },
      }),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance_correction.hr_approve",
      entityType: "attendance_correction",
      entityId: correction.id,
      description: `HR menyetujui koreksi absen (${correction.type})`,
    });

    revalidateTag("attendance-corrections", "max");
    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[hrApproveAttendanceCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function hrRejectAttendanceCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-correction-hr-reject:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = rejectAttendanceCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const correction = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true, type: true },
    });
    if (!correction) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (correction.status !== "pending") return { success: false, error: "Pengajuan sudah diproses." };

    await db.attendanceCorrection.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "rejected",
        reviewedBy: session!.user.profileId,
        reviewedAt: new Date(),
        reviewNote: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance_correction.hr_reject",
      entityType: "attendance_correction",
      entityId: correction.id,
      description: `HR menolak koreksi absen: ${parsed.data.reason}`,
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[hrRejectAttendanceCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function cancelAttendanceCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "attendance", action: "view" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-correction-cancel:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = cancelAttendanceCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session!.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const correction = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true, profileId: true },
    });
    if (!correction) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (correction.profileId !== profileId) {
      return { success: false, error: "Anda tidak berhak membatalkan pengajuan ini." };
    }
    if (correction.status !== "pending") {
      return { success: false, error: "Pengajuan sudah diproses, tidak bisa dibatalkan." };
    }

    await db.attendanceCorrection.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        reviewNote: parsed.data.reason ?? null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance_correction.cancel",
      entityType: "attendance_correction",
      entityId: correction.id,
      description: "Pengajuan koreksi absen dibatalkan",
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[cancelAttendanceCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
