import { db } from "@/lib/db";

export async function getShiftOverrides(params?: {
  profileId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params?.profileId) where.profileId = params.profileId;
  if (params?.startDate || params?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (params?.startDate) dateFilter.gte = new Date(params.startDate);
    if (params?.endDate) dateFilter.lte = new Date(params.endDate);
    where.date = dateFilter;
  }

  return db.shiftOverride.findMany({
    where,
    select: {
      id: true, profileId: true, date: true,
      workShiftId: true, workLocationId: true,
      reason: true, createdAt: true,
      profile: { select: { id: true, fullName: true, employeeNumber: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
      workLocation: { select: { id: true, name: true } },
      creator: { select: { id: true, fullName: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });
}

export type ShiftOverrideItem = Awaited<ReturnType<typeof getShiftOverrides>>[number];
