import type { LeaveBalanceItem } from "@/lib/queries/leaveBalances";

export async function fetchLeaveBalances(params?: {
  profileId?: string;
  leaveTypeId?: string;
  year?: number;
}): Promise<LeaveBalanceItem[]> {
  const sp = new URLSearchParams();
  if (params?.profileId) sp.set("profileId", params.profileId);
  if (params?.leaveTypeId) sp.set("leaveTypeId", params.leaveTypeId);
  if (params?.year) sp.set("year", String(params.year));
  const res = await fetch(`/api/hr/leave-balances?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch leave balances");
  return res.json() as Promise<LeaveBalanceItem[]>;
}
