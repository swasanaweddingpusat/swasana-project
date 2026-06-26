import type { LeaveTypeItem } from "@/lib/queries/leaveTypes";

export async function fetchLeaveTypes(): Promise<LeaveTypeItem[]> {
  const res = await fetch("/api/hr/leave-types");
  if (!res.ok) throw new Error("Failed to fetch leave types");
  return res.json() as Promise<LeaveTypeItem[]>;
}
