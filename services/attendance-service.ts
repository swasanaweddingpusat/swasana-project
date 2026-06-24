import type {
  AttendanceTodayResponse,
  AttendanceSettingsResult,
  AttendanceListResult,
  MyAttendanceHistoryResult,
  AttendanceExportItem,
} from "@/lib/queries/attendance";
import type { AttendanceListQuery, ClockInInput, ClockOutInput, AttendanceSettingsInput } from "@/lib/validations/attendance";

export async function fetchAttendanceToday(): Promise<AttendanceTodayResponse> {
  const res = await fetch("/api/hr/attendance/today");
  if (!res.ok) throw new Error("Gagal mengambil data absensi hari ini");
  return res.json();
}

export async function fetchAttendanceSettings(): Promise<AttendanceSettingsResult> {
  const res = await fetch("/api/hr/attendance/settings");
  if (!res.ok) throw new Error("Gagal mengambil settings absensi");
  return res.json();
}

export async function fetchAttendanceList(params: AttendanceListQuery): Promise<AttendanceListResult> {
  const sp = new URLSearchParams();
  if (params.profileId) sp.set("profileId", params.profileId);
  if (params.date) sp.set("date", params.date);
  if (params.month) sp.set("month", String(params.month));
  if (params.year) sp.set("year", String(params.year));
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));

  const res = await fetch(`/api/hr/attendance?${sp.toString()}`);
  if (!res.ok) throw new Error("Gagal mengambil data kehadiran");
  return res.json();
}

export async function fetchMyAttendanceHistory(): Promise<MyAttendanceHistoryResult> {
  const res = await fetch("/api/hr/attendance/my-history");
  if (!res.ok) throw new Error("Gagal mengambil riwayat absensi");
  return res.json();
}

export async function clockIn(data: ClockInInput): Promise<unknown> {
  const res = await fetch("/api/hr/attendance/clock-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Gagal clock in");
  return json;
}

export async function clockOut(data: ClockOutInput): Promise<unknown> {
  const res = await fetch("/api/hr/attendance/clock-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Gagal clock out");
  return json;
}

export async function updateAttendanceSettings(data: AttendanceSettingsInput): Promise<unknown> {
  const res = await fetch("/api/hr/attendance/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan settings");
  return json;
}

export async function fetchAttendanceExport(params: {
  date?: string;
  month?: number;
  year?: number;
  profileId?: string;
}): Promise<AttendanceExportItem[]> {
  const sp = new URLSearchParams();
  if (params.profileId) sp.set("profileId", params.profileId);
  if (params.date) sp.set("date", params.date);
  if (params.month) sp.set("month", String(params.month));
  if (params.year) sp.set("year", String(params.year));

  const res = await fetch(`/api/hr/attendance/export?${sp.toString()}`);
  if (!res.ok) throw new Error("Gagal mengambil data export");
  return res.json() as Promise<AttendanceExportItem[]>;
}
