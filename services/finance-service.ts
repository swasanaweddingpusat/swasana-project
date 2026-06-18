import type { CompanyFinanceSummary, GroupFinanceRow } from "@/lib/queries/finance";

export interface FinanceOverviewResponse {
  summary: CompanyFinanceSummary;
  groups: GroupFinanceRow[];
}

export async function fetchFinanceOverview(): Promise<FinanceOverviewResponse> {
  const res = await fetch("/api/finance/overview");
  if (!res.ok) throw new Error("Failed to fetch finance overview");
  return res.json();
}
