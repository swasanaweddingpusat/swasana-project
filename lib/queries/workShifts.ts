import { db } from "@/lib/db";

export async function getWorkShifts() {
  return db.workShift.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, startTime: true, endTime: true,
      lateToleranceMinutes: true, isOvernight: true,
      isActive: true, sortOrder: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 200,
  });
}

export type WorkShiftItem = Awaited<ReturnType<typeof getWorkShifts>>[number];
