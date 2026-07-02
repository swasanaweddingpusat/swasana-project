import type { PositionItem } from "@/lib/queries/positions";

export async function fetchPositions(departmentId?: string): Promise<PositionItem[]> {
  const sp = departmentId ? `?departmentId=${departmentId}` : "";
  const res = await fetch(`/api/hr/positions${sp}`);
  if (!res.ok) throw new Error("Failed to fetch positions");
  return res.json() as Promise<PositionItem[]>;
}
