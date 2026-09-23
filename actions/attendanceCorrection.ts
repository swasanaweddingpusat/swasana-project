"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  submitAttendanceCorrectionSchema,
  approveCorrectionSchema,
  rejectCorrectionSchema,
  cancelCorrectionSchema,
} from "@/lib/validations/attendanceCorrection";
import { uploadToStorage, randomId12 } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";
import type { FileDescriptor } from "@/lib/validations/common";
import type { Prisma } from "@prisma/client";

export async function submitAttendanceCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`correction-submit:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = submitAttendanceCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    // JWT only checks token existence; verify the account is still active
    // (mirrors the check in actions/leaveRequest.ts submitLeaveRequest).
    const callerProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: { status: true },
    });
    if (!callerProfile || callerProfile.status !== "active") {
      return { success: false, error: "Akun Anda tidak aktif." };
    }

    const date = new Date(parsed.data.date);
    date.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) return { success: false, error: "Tidak bisa mengajukan koreksi untuk tanggal di masa depan." };

    const existing = await db.attendanceCorrection.findFirst({
      where: {
        profileId,
        date,
        status: { in: ["pending", "manager_approved", "approved"] },
      },
      select: { id: true },
    });
    if (existing) return { success: false, error: "Sudah ada pengajuan koreksi untuk tanggal ini." };

    let evidence: FileDescriptor | undefined;
    if (parsed.data.evidenceBase64) {
      const dateStr = date.toISOString().slice(0, 10);
      const base64Data = parsed.data.evidenceBase64.replace(/^data:image\/\w+;base64,/, "");
      const rawBuffer = Buffer.from(base64Data, "base64");
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
    }

    const request = await db.attendanceCorrection.create({
      data: {
        profileId,
        date,
        requestedClockInAt: parsed.data.requestedClockInAt ?? null,
        requestedClockOutAt: parsed.data.requestedClockOutAt ?? null,
        reason: parsed.data.reason,
        evidence: evidence ? (evidence as Prisma.InputJsonValue) : undefined,
        status: "pending",
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance_correction.submit",
      entityType: "attendance_correction",
      entityId: request.id,
      description: `Pengajuan koreksi absen tanggal ${date.toISOString().slice(0, 10)}`,
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[submitAttendanceCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function managerApproveCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`correction-mgr-approve:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = approveCorrectionSchema.safeParse(data);
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

    const request = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true, profile: { select: { managerId: true } } },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "pending") return { success: false, error: "Pengajuan sudah diproses." };
    if (request.profile.managerId !== profileId) {
      return { success: false, error: "Anda bukan manager dari karyawan ini." };
    }

    await db.attendanceCorrection.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "manager_approved",
        managerApprovedBy: profileId,
        managerApprovedAt: new Date(),
        managerNote: parsed.data.note ?? null,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance_correction.manager_approve",
      entityType: "attendance_correction",
      entityId: request.id,
      description: "Manager menyetujui pengajuan koreksi absen",
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[managerApproveCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function managerRejectCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`correction-mgr-reject:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = rejectCorrectionSchema.safeParse(data);
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

    const request = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true, profile: { select: { managerId: true } } },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "pending") return { success: false, error: "Pengajuan sudah diproses." };
    if (request.profile.managerId !== profileId) {
      return { success: false, error: "Anda bukan manager dari karyawan ini." };
    }

    await db.attendanceCorrection.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "rejected",
        rejectedBy: profileId,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance_correction.manager_reject",
      entityType: "attendance_correction",
      entityId: request.id,
      description: `Manager menolak pengajuan koreksi absen: ${parsed.data.reason}`,
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[managerRejectCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function hrApproveCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "attendance-correction", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`correction-hr-approve:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = approveCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const request = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "manager_approved") {
      return { success: false, error: "Pengajuan belum disetujui manager." };
    }

    const attendanceFields: Prisma.AttendanceUpdateInput = { status: "on_time" };
    if (request.requestedClockInAt) attendanceFields.clockInAt = request.requestedClockInAt;
    if (request.requestedClockOutAt) attendanceFields.clockOutAt = request.requestedClockOutAt;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.attendanceCorrection.update({
        where: { id: parsed.data.requestId },
        data: {
          status: "approved",
          hrApprovedBy: session!.user.profileId,
          hrApprovedAt: new Date(),
          hrNote: parsed.data.note ?? null,
        },
      }),
      db.attendance.upsert({
        where: { profileId_date: { profileId: request.profileId, date: request.date } },
        create: {
          profileId: request.profileId,
          date: request.date,
          status: "on_time",
          clockInAt: request.requestedClockInAt ?? undefined,
          clockOutAt: request.requestedClockOutAt ?? undefined,
        },
        update: attendanceFields,
      }),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance_correction.hr_approve",
      entityType: "attendance_correction",
      entityId: request.id,
      description: "HR menyetujui pengajuan koreksi absen",
    });

    revalidateTag("attendance-corrections", "max");
    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[hrApproveCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function hrRejectCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "attendance-correction", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`correction-hr-reject:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = rejectCorrectionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const request = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "manager_approved") {
      return { success: false, error: "Pengajuan belum disetujui manager." };
    }

    await db.attendanceCorrection.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "rejected",
        rejectedBy: session!.user.profileId,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "attendance_correction.hr_reject",
      entityType: "attendance_correction",
      entityId: request.id,
      description: `HR menolak pengajuan koreksi absen: ${parsed.data.reason}`,
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[hrRejectCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function cancelAttendanceCorrection(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`correction-cancel:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = cancelCorrectionSchema.safeParse(data);
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

    const request = await db.attendanceCorrection.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, profileId: true, status: true },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.profileId !== profileId) {
      return { success: false, error: "Anda tidak berhak membatalkan pengajuan ini." };
    }
    if (request.status !== "pending" && request.status !== "manager_approved") {
      return { success: false, error: "Pengajuan sudah diproses, tidak bisa dibatalkan." };
    }

    await db.attendanceCorrection.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: parsed.data.reason ?? null,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance_correction.cancel",
      entityType: "attendance_correction",
      entityId: request.id,
      description: "Pengajuan koreksi absen dibatalkan",
    });

    revalidateTag("attendance-corrections", "max");
    return { success: true };
  } catch (e) {
    console.error("[cancelAttendanceCorrection]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
