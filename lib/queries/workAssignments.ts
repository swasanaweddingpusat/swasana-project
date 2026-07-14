import { db } from "@/lib/db";

export async function getWorkAssignments(params?: {
  workLocationId?: string;
  workShiftId?: string;
  profileId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params?.workLocationId) where.workLocationId = params.workLocationId;
  if (params?.workShiftId) where.workShiftId = params.workShiftId;
  if (params?.profileId) where.profileId = params.profileId;

  return db.employeeWorkAssignment.findMany({
    where,
    select: {
      id: true, profileId: true, workLocationId: true, workShiftId: true,
      isDefault: true, offdayDays: true, effectiveDate: true, endDate: true,
      profile: { select: { id: true, fullName: true, avatarUrl: true, employeeNumber: true } },
      workLocation: { select: { id: true, name: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type WorkAssignmentItem = Awaited<ReturnType<typeof getWorkAssignments>>[number];
