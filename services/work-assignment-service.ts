import type { WorkAssignmentItem } from "@/lib/queries/workAssignments";

export async function fetchWorkAssignments(params?: {
  workLocationId?: string;
  workShiftId?: string;
  profileId?: string;
}): Promise<WorkAssignmentItem[]> {
  const url = new URL("/api/hr/work-assignments", window.location.origin);
  if (params?.workLocationId) url.searchParams.set("workLocationId", params.workLocationId);
  if (params?.workShiftId) url.searchParams.set("workShiftId", params.workShiftId);
  if (params?.profileId) url.searchParams.set("profileId", params.profileId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch work assignments");
  return res.json() as Promise<WorkAssignmentItem[]>;
}
