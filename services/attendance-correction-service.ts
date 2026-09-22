import type { AttendanceCorrectionItem } from "@/lib/queries/attendanceCorrections";

export async function fetchAttendanceCorrections(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}): Promise<AttendanceCorrectionItem[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.departmentId) sp.set("departmentId", params.departmentId);
  if (params?.profileId) sp.set("profileId", params.profileId);
  const res = await fetch(`/api/hr/attendance-corrections?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch attendance corrections");
  return res.json() as Promise<AttendanceCorrectionItem[]>;
}

export async function fetchMyAttendanceCorrections(): Promise<AttendanceCorrectionItem[]> {
  const res = await fetch("/api/hr/attendance-corrections/my");
  if (!res.ok) throw new Error("Failed to fetch my attendance corrections");
  return res.json() as Promise<AttendanceCorrectionItem[]>;
}
