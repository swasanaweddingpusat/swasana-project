import { db } from "@/lib/db";
import type { AttendanceListQuery } from "@/lib/validations/attendance";

export function todayMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getAttendanceToday(profileId: string) {
  const today = todayMidnightUTC();
  return db.attendance.findUnique({
    where: { profileId_date: { profileId, date: today } },
  });
}

export async function getAttendanceSettings() {
  return db.attendanceSettings.findFirst();
}

export async function getAttendanceList(params: AttendanceListQuery) {
  const { profileId, date, month, year, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (profileId) {
    where.profileId = profileId;
  }

  if (date) {
    const d = new Date(date);
    const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    where.date = { gte: start, lt: end };
  } else if (month && year) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    where.date = { gte: start, lt: end };
  }

  const [data, total] = await Promise.all([
    db.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: limit,
      include: {
        profile: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    }),
    db.attendance.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getMyAttendanceHistory(profileId: string, limit = 30) {
  return db.attendance.findMany({
    where: { profileId },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      clockInAt: true,
      clockOutAt: true,
      status: true,
    },
  });
}

export type AttendanceTodayResult = Awaited<ReturnType<typeof getAttendanceToday>>;
export type AttendanceSettingsResult = Awaited<ReturnType<typeof getAttendanceSettings>>;
export type AttendanceListResult = Awaited<ReturnType<typeof getAttendanceList>>;
export type AttendanceListItem = AttendanceListResult["data"][number];
export type MyAttendanceHistoryResult = Awaited<ReturnType<typeof getMyAttendanceHistory>>;
export type MyAttendanceHistoryItem = MyAttendanceHistoryResult[number];
