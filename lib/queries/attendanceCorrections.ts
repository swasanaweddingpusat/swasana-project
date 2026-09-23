import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

function isTableMissing(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  if (e.code === "P2010" && String(e.message).includes("does not exist")) return true;
  return false;
}

const correctionSelect = {
  id: true,
  profileId: true,
  date: true,
  requestedClockInAt: true,
  requestedClockOutAt: true,
  reason: true,
  evidence: true,
  status: true,
  managerApprovedBy: true,
  managerApprovedAt: true,
  managerNote: true,
  hrApprovedBy: true,
  hrApprovedAt: true,
  hrNote: true,
  rejectedBy: true,
  rejectedAt: true,
  rejectionReason: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  profile: {
    select: {
      id: true,
      fullName: true,
      employeeNumber: true,
      avatarUrl: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  },
  managerApprover: { select: { id: true, fullName: true } },
  hrApprover: { select: { id: true, fullName: true } },
  rejector: { select: { id: true, fullName: true } },
} satisfies Prisma.AttendanceCorrectionSelect;

export async function getAttendanceCorrections(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}) {
  const where: Prisma.AttendanceCorrectionWhereInput = {};
  if (params?.status) {
    where.status = params.status as Prisma.EnumLeaveRequestStatusFilter<"AttendanceCorrection">;
  }
  if (params?.profileId) where.profileId = params.profileId;
  if (params?.departmentId) {
    where.profile = { departmentId: params.departmentId };
  }

  try {
    return await db.attendanceCorrection.findMany({
      where,
      select: correctionSelect,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getMyAttendanceCorrections(profileId: string) {
  try {
    return await db.attendanceCorrection.findMany({
      where: { profileId },
      select: correctionSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getPendingCorrectionsForManager(managerId: string) {
  try {
    return await db.attendanceCorrection.findMany({
      where: {
        status: "pending",
        profile: { managerId },
      },
      select: correctionSelect,
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export type AttendanceCorrectionItem = Awaited<ReturnType<typeof getAttendanceCorrections>>[number];
