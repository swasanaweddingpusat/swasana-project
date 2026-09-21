import { db } from "@/lib/db";
import type { AttendanceListQuery, AttendanceExportQuery, AttendanceOverviewQuery } from "@/lib/validations/attendance";
import type { AttendanceContext } from "@/lib/attendance-helpers";

export function todayMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getAttendanceToday(profileId: string) {
  const today = todayMidnightUTC();
  return db.attendance.findUnique({
    where: { profileId_date: { profileId, date: today } },
    include: {
      workLocation: { select: { id: true, name: true } },
      workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });
}

export async function getAttendanceSettings() {
  return db.attendanceSettings.findFirst();
}

export async function getAttendanceList(params: AttendanceListQuery) {
  const { profileId, venueId, date, month, year, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (profileId) {
    where.profileId = profileId;
  }

  if (venueId) {
    where.workLocation = { venueId };
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
  } else if (year) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
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
        workLocation: { select: { id: true, name: true } },
        workShift: { select: { id: true, name: true } },
      },
    }),
    db.attendance.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getMyAttendanceHistory(profileId: string, limit = 30) {
  const today = todayMidnightUTC();
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - (limit - 1));
  const dateWhere = { gte: startDate, lte: today };

  const [attendance, holidays] = await Promise.all([
    db.attendance.findMany({
      where: { profileId, date: dateWhere },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        clockInAt: true,
        clockOutAt: true,
        status: true,
        isPublicHoliday: true,
        publicHolidayName: true,
      },
    }),
    db.publicHoliday.findMany({
      where: { date: dateWhere, isActive: true },
      orderBy: { date: "desc" },
      select: { id: true, date: true, name: true },
      take: limit,
    }),
  ]);

  const attendanceDates = new Set(attendance.map((record) => record.date.toISOString()));
  const holidayRows = holidays
    .filter((holiday) => !attendanceDates.has(holiday.date.toISOString()))
    .map((holiday) => ({
      id: `holiday-${holiday.id}`,
      date: holiday.date,
      clockInAt: null,
      clockOutAt: null,
      status: "public_holiday" as const,
      isPublicHoliday: true,
      publicHolidayName: holiday.name,
    }));

  return [...attendance, ...holidayRows]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);
}

export type AttendanceTodayResult = Awaited<ReturnType<typeof getAttendanceToday>>;
export type AttendanceSettingsResult = Awaited<ReturnType<typeof getAttendanceSettings>>;
export type AttendanceListResult = Awaited<ReturnType<typeof getAttendanceList>>;
export type AttendanceListItem = AttendanceListResult["data"][number];
export type MyAttendanceHistoryResult = Awaited<ReturnType<typeof getMyAttendanceHistory>>;
export type MyAttendanceHistoryItem = MyAttendanceHistoryResult[number];

export type AttendanceTodayShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  isOvernight: boolean;
};

export type AttendanceTodayResponse = {
  attendance: AttendanceTodayResult;
  shift: AttendanceTodayShift | null;
  shiftSource: "override" | "assignment" | null;
  context: AttendanceContext;
};

export async function getAttendanceForExport(params: AttendanceExportQuery) {
  const { profileId, date, month, year } = params;

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
  } else if (year) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    where.date = { gte: start, lt: end };
  }

  return db.attendance.findMany({
    where,
    orderBy: [{ date: "asc" }, { profile: { fullName: "asc" } }],
    take: 5000,
    select: {
      id: true,
      date: true,
      clockInAt: true,
      clockInLat: true,
      clockInLng: true,
      clockOutAt: true,
      clockOutLat: true,
      clockOutLng: true,
      status: true,
      attendantType: true,
      isPublicHoliday: true,
      workType: true,
      profile: { select: { fullName: true } },
      workLocation: { select: { name: true } },
      workShift: { select: { name: true } },
    },
  });
}

export type AttendanceExportItem = Awaited<ReturnType<typeof getAttendanceForExport>>[number];

export async function getEmployeeAttendanceOverview(params: AttendanceOverviewQuery) {
  const { profileId, date, month, year } = params;

  const where: Record<string, unknown> = { profileId };

  if (date) {
    const d = new Date(date);
    const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    where.date = { gte: start, lt: end };
  } else if (month && year) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    where.date = { gte: start, lt: end };
  } else if (year) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    where.date = { gte: start, lt: end };
  }

  const [profile, records] = await Promise.all([
    db.profile.findUnique({ where: { id: profileId }, select: { id: true, fullName: true, avatarUrl: true } }),
    db.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      take: 400,
      select: {
        id: true,
        date: true,
        clockInAt: true,
        clockOutAt: true,
        status: true,
        attendantType: true,
        isPublicHoliday: true,
        workType: true,
        workLocation: { select: { id: true, name: true } },
        workShift: { select: { id: true, name: true } },
      },
    }),
  ]);

  const summary = {
    hadir: records.filter((r) => r.status === "on_time" || r.status === "late").length,
    telat: records.filter((r) => r.status === "late").length,
    absen: records.filter((r) => r.status === "absent" && r.attendantType === "WORKDAY" && !r.isPublicHoliday).length,
    libur: records.filter((r) => r.attendantType === "DAY_OFF").length,
    tanggalMerah: records.filter((r) => r.isPublicHoliday).length,
  };

  return { profile, summary, records };
}

export type EmployeeAttendanceOverview = Awaited<ReturnType<typeof getEmployeeAttendanceOverview>>;
export type EmployeeAttendanceOverviewRecord = EmployeeAttendanceOverview["records"][number];
