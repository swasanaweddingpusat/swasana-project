import type { LeaveRequestItem, LeaveCalendarItem } from "@/lib/queries/leaveRequests";

export async function fetchLeaveRequests(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}): Promise<LeaveRequestItem[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.departmentId) sp.set("departmentId", params.departmentId);
  if (params?.profileId) sp.set("profileId", params.profileId);
  const res = await fetch(`/api/hr/leave-requests?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch leave requests");
  return res.json() as Promise<LeaveRequestItem[]>;
}

export async function fetchMyLeaveRequests(): Promise<LeaveRequestItem[]> {
  const res = await fetch("/api/hr/leave-requests/my");
  if (!res.ok) throw new Error("Failed to fetch my leave requests");
  return res.json() as Promise<LeaveRequestItem[]>;
}

export async function fetchPendingForManager(): Promise<LeaveRequestItem[]> {
  const res = await fetch("/api/hr/leave-requests/pending");
  if (!res.ok) throw new Error("Failed to fetch pending requests");
  return res.json() as Promise<LeaveRequestItem[]>;
}

export async function fetchLeaveCalendar(params: {
  departmentId?: string;
  startDate: string;
  endDate: string;
}): Promise<LeaveCalendarItem[]> {
  const sp = new URLSearchParams();
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  sp.set("startDate", params.startDate);
  sp.set("endDate", params.endDate);
  const res = await fetch(`/api/hr/leave-calendar?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch leave calendar");
  return res.json() as Promise<LeaveCalendarItem[]>;
}
